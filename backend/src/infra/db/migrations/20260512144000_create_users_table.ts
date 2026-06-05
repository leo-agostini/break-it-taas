import type { Knex } from 'knex';

const TABLE_NAME = 'users';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.uuid('id').primary();
    table.string('name', 255).notNullable();
    table.string('email', 320).notNullable().unique();
    table.uuid('org_id').nullable();
    table.enum('role', ['OWNER', 'ADMIN', 'MEMBER']).nullable();
    table.text('password_hash').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
