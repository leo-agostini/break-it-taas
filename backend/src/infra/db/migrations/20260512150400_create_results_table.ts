import type { Knex } from 'knex';

const TABLE_NAME = 'results';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.uuid('id').primary();
    table
      .specificType('internal_id', 'bigint generated always as identity')
      .notNullable()
      .unique();
    table
      .uuid('test_run_id')
      .notNullable()
      .references('id')
      .inTable('test_runs')
      .onDelete('CASCADE')
      .unique();
    table.jsonb('payload').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();

    table.index(['test_run_id'], 'idx_results_test_run_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
