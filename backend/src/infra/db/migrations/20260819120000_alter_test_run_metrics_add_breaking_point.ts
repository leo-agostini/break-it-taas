import type { Knex } from 'knex';

const TABLE_NAME = 'test_run_metrics';

/**
 * A BREAKPOINT run is stopped early by a breached abortOnFail threshold, and
 * the load it reached at that moment is the result the test exists to produce.
 * Neither fact was representable before.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.boolean('aborted').notNullable().defaultTo(false);
    table.decimal('breaking_point_rate', 14, 4).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropColumn('aborted');
    table.dropColumn('breaking_point_rate');
  });
}
