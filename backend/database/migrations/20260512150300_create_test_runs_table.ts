import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
  protected tableName = 'test_runs';

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary();
      table
        .specificType('internal_id', 'bigint generated always as identity')
        .notNullable()
        .unique();
      table
        .uuid('test_case_id')
        .notNullable()
        .references('id')
        .inTable('test_cases')
        .onDelete('CASCADE');
      table
        .enum('status', [
          'CREATED',
          'QUEUED',
          'RUNNING',
          'SUCCEEDED',
          'FAILED',
          'TIMEOUT',
          'CANCELLED',
        ])
        .notNullable();
      table.timestamp('started_at', { useTz: true }).nullable();
      table.timestamp('completed_at', { useTz: true }).nullable();
      table.string('runtime_ref', 255).nullable();
      table.timestamp('created_at', { useTz: true }).notNullable();

      table.index(['test_case_id'], 'idx_test_runs_test_case_id');
      table.index(['status'], 'idx_test_runs_status');
      table.index(['created_at'], 'idx_test_runs_created_at');
    });
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName);
  }
}
