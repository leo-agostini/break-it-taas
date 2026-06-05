import type { Knex } from 'knex';

const TABLE_NAME = 'outbox_events';
const INDEX_NAME = 'idx_outbox_events_pending_next_attempt';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `alter table ${TABLE_NAME} drop constraint if exists ${TABLE_NAME}_status_check`,
  );
  await knex.raw(
    `alter table ${TABLE_NAME} add constraint ${TABLE_NAME}_status_check check (status in ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'))`,
  );

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table
      .timestamp('next_attempt_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('processing_started_at', { useTz: true }).nullable();
  });

  await knex.raw(
    `update ${TABLE_NAME} set next_attempt_at = created_at where next_attempt_at is null`,
  );

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.index(['status', 'next_attempt_at', 'created_at'], INDEX_NAME);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `alter table ${TABLE_NAME} drop constraint if exists ${TABLE_NAME}_status_check`,
  );
  await knex.raw(
    `alter table ${TABLE_NAME} add constraint ${TABLE_NAME}_status_check check (status in ('PENDING', 'PUBLISHED', 'FAILED'))`,
  );

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropIndex(['status', 'next_attempt_at', 'created_at'], INDEX_NAME);
    table.dropColumn('processing_started_at');
    table.dropColumn('next_attempt_at');
  });
}
