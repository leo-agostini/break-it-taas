import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
  protected tableName = 'users';

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .specificType('internal_id', 'bigint generated always as identity')
        .notNullable()
        .unique();
    });

    this.schema.alterTable(this.tableName, (table) => {
      table
        .foreign('org_id')
        .references('id')
        .inTable('organizations')
        .onDelete('SET NULL');
    });
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['org_id']);
      table.dropColumn('internal_id');
    });
  }
}
