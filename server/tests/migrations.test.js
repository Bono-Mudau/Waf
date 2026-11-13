import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './database.js';
import { migrate } from '../db/migrate.js';

const legacy = `
CREATE TABLE users(id BIGSERIAL PRIMARY KEY,full_name VARCHAR(150) NOT NULL,email VARCHAR(255) NOT NULL,password_hash TEXT NOT NULL,role VARCHAR(20) NOT NULL CHECK(role IN ('admin','developer')));
CREATE TABLE services(id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id BIGINT REFERENCES users(id),name VARCHAR(150) NOT NULL,description TEXT,base_url TEXT,mode VARCHAR(20) DEFAULT 'local',strictness VARCHAR(20) DEFAULT 'normal',CHECK(id=0 OR user_id IS NOT NULL));
INSERT INTO users(full_name,email,password_hash,role) VALUES('Legacy administrator','legacy@example.test','not-a-real-password-hash','admin');
INSERT INTO services(user_id,name) VALUES(1,'Existing service');
`;
test('legacy membership migration preserves users, service IDs and existing shared rules', async () => {
  const db = await testDatabase();
  try {
    await db.pool.query(legacy);
    await db.pool.query(
      `INSERT INTO services(id,user_id,name) OVERRIDING SYSTEM VALUE VALUES(0,NULL,'Shared defaults');CREATE TABLE rules(id BIGSERIAL PRIMARY KEY,service_id BIGINT REFERENCES services(id),name TEXT,pattern TEXT,match_type TEXT,score INTEGER,enabled BOOLEAN,created_at TIMESTAMPTZ DEFAULT NOW(),UNIQUE(service_id,name));INSERT INTO rules(service_id,name,pattern,match_type,score,enabled) VALUES(0,'Existing shared rule','existing','keyword',5,TRUE)`
    );
    await migrate(db.pool);
    await migrate(db.pool);
    const row = (
      await db.pool.query('SELECT service_id,email,role FROM users WHERE id=1')
    ).rows[0];
    assert.equal(String(row.service_id), '1');
    assert.equal(row.email, 'legacy@example.test');
    assert.equal(row.role, 'admin');
    assert.equal(
      Number(
        (await db.pool.query('SELECT COUNT(*) FROM rules WHERE service_id=0'))
          .rows[0].count
      ),
      1,
      'An existing default catalogue is preserved exactly'
    );
    assert.equal(
      (
        await db.pool.query(
          "INSERT INTO services(name) VALUES('New service') RETURNING id"
        )
      ).rows[0].id,
      '2'
    );
  } finally {
    await db.close();
  }
});
test('ambiguous legacy memberships roll back the entire migration without deleting data', async () => {
  const db = await testDatabase();
  try {
    await db.pool.query(
      legacy +
        "INSERT INTO services(user_id,name) VALUES(1,'Second legacy service');"
    );
    await assert.rejects(migrate(db.pool), /multiple services/);
    assert.equal(
      Number((await db.pool.query('SELECT COUNT(*) FROM users')).rows[0].count),
      1
    );
    assert.equal(
      Number(
        (await db.pool.query('SELECT COUNT(*) FROM services')).rows[0].count
      ),
      2
    );
    const columns = (
      await db.pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users'"
      )
    ).rows;
    assert.equal(
      columns.some((row) => row.column_name === 'service_id'),
      false
    );
  } finally {
    await db.close();
  }
});
