import knex from 'knex';
import config from '../../../knexfile';

const env = process.env.NODE_ENV === 'production' ? 'development' : 'development';

async function run(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  const db = knex(config[env]);

  try {
    if (command === 'down') {
      await db.migrate.rollback();
      console.info('Migrations rolled back');
      return;
    }

    await db.migrate.latest();
    console.info('Migrations applied');
  } finally {
    await db.destroy();
  }
}

run().catch((error) => {
  console.error('Migration command failed', error);
  process.exit(1);
});
