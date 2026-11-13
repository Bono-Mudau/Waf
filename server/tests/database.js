import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';
import net from 'node:net';
import { randomBytes } from 'node:crypto';

export async function testDatabase() {
  if (process.env.TEST_DATABASE_URL) {
    const schema = `sqlishield_test_${randomBytes(8).toString('hex')}`;
    const admin = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
      connectionTimeoutMillis: 5000,
    });
    return {
      pool,
      async close() {
        await pool.end();
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
      },
    };
  }
  const db = await PGlite.create();
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const number = server.address().port;
      server.close(() => resolve(number));
    });
  });
  const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port });
  await socket.start();
  // PGlite multiplexes one PostgreSQL connection. A single pool client keeps transactions exclusive.
  const pool = new pg.Pool({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    database: 'postgres',
    password: 'postgres',
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  return {
    pool,
    async close() {
      await pool.end();
      await socket.stop();
      await db.close();
    },
  };
}
