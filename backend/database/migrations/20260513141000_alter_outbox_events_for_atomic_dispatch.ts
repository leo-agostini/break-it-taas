import { BaseSchema } from '@adonisjs/lucid/schema';

const INDEX_NAME = 'idx_outbox_events_pending_next_attempt';

export default class extends BaseSchema {
  protected tableName = 'outbox_events';

  async up() {
    this.schema.raw(
      `alter table ${this.tableName} drop constraint if exists ${this.tableName}_status_check`,
    );
    this.schema.raw(
      `alter table ${this.tableName} add constraint ${this.tableName}_status_check check (status in ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'))`,
    );

    this.schema.alterTable(this.tableName, (table) => {
      table
        .timestamp('next_attempt_at', { useTz: true })
        .notNullable()
        .defaultTo(this.now());
      table.timestamp('processing_started_at', { useTz: true }).nullable();
    });

    this.schema.raw(
      `update ${this.tableName} set next_attempt_at = created_at where next_attempt_at is null`,
    );

    this.schema.alterTable(this.tableName, (table) => {
      table.index(['status', 'next_attempt_at', 'created_at'], INDEX_NAME);
    });
  }

  async down() {
    this.schema.raw(
      `alter table ${this.tableName} drop constraint if exists ${this.tableName}_status_check`,
    );
    this.schema.raw(
      `alter table ${this.tableName} add constraint ${this.tableName}_status_check check (status in ('PENDING', 'PUBLISHED', 'FAILED'))`,
    );

    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['status', 'next_attempt_at', 'created_at'], INDEX_NAME);
      table.dropColumn('processing_started_at');
      table.dropColumn('next_attempt_at');
    });
  }
}
