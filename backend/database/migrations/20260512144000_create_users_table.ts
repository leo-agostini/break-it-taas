import { BaseSchema } from '@adonisjs/lucid/schema';

export default class extends BaseSchema {
  protected tableName = 'users';

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary();
      table.string('name', 255).notNullable();
      table.string('email', 320).notNullable().unique();
      table.uuid('org_id').nullable();
      table.enum('role', ['OWNER', 'ADMIN', 'MEMBER']).nullable();
      table.text('password_hash').notNullable();
      table.timestamp('created_at', { useTz: true }).notNullable();
    });
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName);
  }
}
