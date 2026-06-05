import { env } from '@/infra/config/env';
import knex, { type Knex } from 'knex';

const config: Knex.Config = {
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: {
    min: 2,
    max: 10,
  },
};

export const db = knex(config);
