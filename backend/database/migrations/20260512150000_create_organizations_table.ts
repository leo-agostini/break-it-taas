import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
  protected tableName = 'organizations';

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary();
      table
        .specificType('internal_id', 'bigint generated always as identity')
        .notNullable()
        .unique();
      table.string('name', 255).notNullable();
      table.uuid('owner_user_id').nullable();
      table.timestamp('created_at', { useTz: true }).notNullable();
    });
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName);
  }
}
