import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
  protected tableName = 'outbox_events';

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary();
      table
        .specificType('internal_id', 'bigint generated always as identity')
        .notNullable()
        .unique();
      table.string('type', 255).notNullable();
      table.uuid('aggregate_id').notNullable();
      table.jsonb('payload').notNullable();
      table.enum('status', ['PENDING', 'PUBLISHED', 'FAILED']).notNullable();
      table.integer('attempts').notNullable().defaultTo(0);
      table.timestamp('published_at', { useTz: true }).nullable();
      table.text('last_error').nullable();
      table.timestamp('created_at', { useTz: true }).notNullable();

      table.index(
        ['status', 'created_at'],
        'idx_outbox_events_status_created_at',
      );
    });
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName);
  }
}
