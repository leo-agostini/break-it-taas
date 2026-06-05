import type { Knex } from 'knex';

const TABLE_NAME = 'organizations';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.uuid('id').primary();
    table
      .specificType('internal_id', 'bigint generated always as identity')
      .notNullable()
      .unique();
    table.string('name', 255).notNullable();
    table.uuid('owner_user_id').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
