import knex, { type Knex } from "knex";
import { env } from "@/config/env";

const config: Knex.Config = {
  client: "pg",
  connection: env.DATABASE_URL,
  pool: {
    min: 2,
    max: 10,
  },
};

export const db = knex(config);
