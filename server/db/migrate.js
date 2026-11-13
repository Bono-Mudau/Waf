import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { createPool, transaction } from './dbConfig.js';
import { defaultRules } from './defaultRules.js';

export async function migrate(pool) {
  await transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(7382026)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
    );
    if (
      !(
        await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [
          '001',
        ])
      ).rowCount
    ) {
      await client.query(
        await readFile(
          new URL('./migrations/001_schema.sql', import.meta.url),
          'utf8'
        )
      );
      // Preserve an existing shared catalogue, including locally tuned rules.
      const existingDefaults = await client.query(
        'SELECT 1 FROM rules WHERE service_id=0 LIMIT 1'
      );
      if (!existingDefaults.rowCount)
        for (const rule of defaultRules)
          await client.query(
            'INSERT INTO rules(service_id,name,pattern,match_type,score,enabled) VALUES(0,$1,$2,$3,$4,TRUE) ON CONFLICT(service_id,name) DO NOTHING',
            [rule.name, rule.pattern, rule.match_type, rule.score]
          );
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [
        '001',
      ]);
    }
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  dotenv.config({ quiet: true });
  const pool = createPool();
  try {
    await migrate(pool);
    console.log('SQLiShield database migrations applied.');
  } catch (error) {
    console.error('Migration rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
