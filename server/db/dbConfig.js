import pg from 'pg';

export function createPool(env = process.env) {
  return new pg.Pool({
    ...(env.DATABASE_URL
      ? { connectionString: env.DATABASE_URL }
      : {
          host: env.DB_HOST || 'localhost',
          port: Number(env.DB_PORT || 5432),
          database: env.DB_NAME || 'sqlishield',
          user: env.DB_USER || 'postgres',
          password: String(env.DB_PASSWORD || ''),
        }),
    ...(env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
}

export async function transaction(pool, action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
