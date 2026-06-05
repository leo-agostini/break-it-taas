import type { Knex } from 'knex';

const TABLE_NAME = 'test_cases';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.uuid('id').primary();
    table
      .specificType('internal_id', 'bigint generated always as identity')
      .notNullable()
      .unique();
    table.string('name', 255).notNullable();
    table.text('description').nullable();
    table.enum('owner_type', ['USER', 'ORGANIZATION']).notNullable();
    table.uuid('owner_id').notNullable();
    table
      .enum('test_type', [
        'SPIKE',
        'STRESS',
        'SMOKE',
        'AVG_LOAD',
        'SOAK',
        'BREAKPOINT',
      ])
      .notNullable();
    table.jsonb('target_system').notNullable();
    table.jsonb('auth_strategy').notNullable();
    table.jsonb('load_profile').notNullable();
    table.jsonb('threshold_policy').notNullable();
    table.jsonb('execution_policy').notNullable();
    table.jsonb('steps').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();

    table.index(['owner_type', 'owner_id'], 'idx_test_cases_owner');
    table.index(['created_at'], 'idx_test_cases_created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}
