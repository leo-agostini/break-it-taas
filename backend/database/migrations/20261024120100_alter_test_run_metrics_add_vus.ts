import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * Runs can now be driven by virtual users instead of an arrival rate, so the
 * metrics record the VUs a run asked for and the largest pool it reached.
 */
export default class extends BaseSchema {
  protected tableName = 'test_run_metrics';

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('requested_vus').nullable();
      table.integer('peak_vus').nullable();
    });
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('requested_vus');
      table.dropColumn('peak_vus');
    });
  }
}
