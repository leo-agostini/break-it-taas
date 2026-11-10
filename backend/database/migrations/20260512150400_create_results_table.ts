import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
  protected tableName = 'results';

  async up() {
    this.schema.createTable(this.tableName, (table) => {
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

  async down() {
    this.schema.dropTableIfExists(this.tableName);
  }
}
