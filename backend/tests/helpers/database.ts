import pg from 'pg';
import env from '#start/env';

/**
 * Creates the test database on first run. Functional tests migrate and
 * truncate it, so it is deliberately separate from the development database
 * that `.env` points at — and creating it here means a long-lived Compose
 * volume does not need an init script re-run to gain it.
 */
export async function ensureTestDatabase(): Promise<void> {
  const url = new URL(env.get('DATABASE_URL'));
  const database = url.pathname.replace(/^\//, '');

  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to run functional tests against "${database}": the test DATABASE_URL must name a *_test database.`,
    );
  }

  url.pathname = '/postgres';
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();

  try {
    const existing = await client.query(
      'select 1 from pg_database where datname = $1',
      [database],
    );
    if (existing.rowCount === 0) {
      await client.query(`create database "${database}"`);
    }
  } finally {
    await client.end();
  }
}
