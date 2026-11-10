import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
  protected tableName = 'test_run_metrics';

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary();
      table
        .uuid('test_run_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('test_runs')
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
      table.string('runtime_ref', 255).nullable();
      table.timestamp('completed_at', { useTz: true }).nullable();

      table.decimal('requested_rate', 14, 4).nullable();
      table.string('requested_time_unit', 16).nullable();
      table.integer('requested_duration_seconds').nullable();

      table.decimal('achieved_rps', 14, 4).nullable();
      table.integer('total_requests').nullable();
      table.integer('dropped_iterations').nullable();
      table.decimal('failure_rate', 8, 6).nullable();
      table.decimal('success_rate', 8, 6).nullable();
      table.decimal('p95_ms', 14, 4).nullable();
      table.decimal('p99_ms', 14, 4).nullable();
      table.decimal('median_ms', 14, 4).nullable();
      table.boolean('generator_limited').notNullable().defaultTo(false);
      table.boolean('timeouts_detected').notNullable().defaultTo(false);

      table.timestamp('created_at', { useTz: true }).notNullable();
      table.timestamp('updated_at', { useTz: true }).notNullable();

      table.index(['status'], 'idx_test_run_metrics_status');
      table.index(['completed_at'], 'idx_test_run_metrics_completed_at');
    });
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName);
  }
}
