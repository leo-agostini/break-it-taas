import type { Knex } from 'knex';

const TABLE_NAME = 'users';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.specificType('internal_id', 'bigint generated always as identity').notNullable().unique();
  });

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table
      .foreign('org_id')
      .references('id')
      .inTable('organizations')
      .onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropForeign(['org_id']);
    table.dropColumn('internal_id');
  });
}
