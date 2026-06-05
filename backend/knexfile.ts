import type { Knex } from 'knex';

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/app',
    migrations: {
      directory: './src/infra/db/migrations',
    },
    seeds: {
      directory: './src/db/seeds',
    },
  },
};

export default config;
