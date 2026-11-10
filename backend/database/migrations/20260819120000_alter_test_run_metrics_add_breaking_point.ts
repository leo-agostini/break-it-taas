import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * A BREAKPOINT run is stopped early by a breached abortOnFail threshold, and
 * the load it reached at that moment is the result the test exists to produce.
 * Neither fact was representable before.
 */
export default class extends BaseSchema {
  protected tableName = 'test_run_metrics';

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('aborted').notNullable().defaultTo(false);
      table.decimal('breaking_point_rate', 14, 4).nullable();
    });
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('aborted');
      table.dropColumn('breaking_point_rate');
    });
  }
}
