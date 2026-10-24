import { BaseCommand } from '@adonisjs/core/ace';
import type { CommandOptions } from '@adonisjs/core/types/ace';
import db from '@adonisjs/lucid/services/db';

/**
 * One-time adoption of a database migrated by the pre-Adonis Knex runner.
 *
 * The Lucid migrations in database/migrations are 1:1 ports of the old Knex
 * ones and produce an identical schema (verified with pg_dump --schema-only),
 * but Lucid records applied migrations in `adonis_schema` rather than
 * `knex_migrations`. Without this, `migration:run` against an existing
 * database tries to recreate tables that already exist.
 *
 * Idempotent, and a no-op on a database Knex never touched — so Compose runs
 * it before every `migration:run`.
 */
export default class DbAdoptKnex extends BaseCommand {
  static commandName = 'db:adopt-knex';
  static description =
    'Mark migrations applied by the legacy Knex runner as applied in Lucid';

  static options: CommandOptions = {
    startApp: true,
  };

  async run() {
    const { rows } = await db.rawQuery(
      "select to_regclass('public.knex_migrations') is not null as present",
    );
    if (!rows[0]?.present) {
      this.logger.info('No knex_migrations table, nothing to adopt');
      return;
    }

    await db.transaction(async (trx) => {
      await trx.rawQuery(`
        create table if not exists adonis_schema (
          id serial primary key,
          name varchar(255) not null,
          batch integer not null,
          migration_time timestamptz default current_timestamp
        )
      `);
      await trx.rawQuery(`
        create table if not exists adonis_schema_versions (
          version integer primary key
        )
      `);
      await trx.rawQuery(`
        insert into adonis_schema_versions (version)
        select 2
        where not exists (select 1 from adonis_schema_versions)
      `);

      const adopted = await trx.rawQuery(`
        insert into adonis_schema (name, batch)
        select 'database/migrations/' || regexp_replace(k.name, '\\.ts$', ''), 1
        from knex_migrations k
        where not exists (
          select 1
          from adonis_schema a
          where a.name = 'database/migrations/' || regexp_replace(k.name, '\\.ts$', '')
        )
        order by k.id
      `);

      this.logger.info(
        `Adopted ${adopted.rowCount ?? 0} Knex migration(s) into adonis_schema`,
      );
    });
  }
}
