-- One-time adoption of a database migrated by the pre-Adonis Knex runner.
--
-- The Lucid migrations in database/migrations are 1:1 ports of the old Knex
-- ones and produce an identical schema (verified with pg_dump --schema-only),
-- but Lucid tracks applied migrations in `adonis_schema` instead of
-- `knex_migrations`. Without this, `node ace migration:run` against an
-- existing database tries to recreate tables that already exist.
--
-- Safe to run more than once; a no-op on a fresh database.
--   docker exec -i breakit-postgres psql -U postgres -d app < backend/database/baseline_from_knex.sql

create table if not exists adonis_schema (
  id serial primary key,
  name varchar(255) not null,
  batch integer not null,
  migration_time timestamptz default current_timestamp
);

create table if not exists adonis_schema_versions (
  version integer primary key
);

insert into adonis_schema_versions (version)
select 2
where not exists (select 1 from adonis_schema_versions);

do $$
begin
  if to_regclass('public.knex_migrations') is not null then
    insert into adonis_schema (name, batch)
    select 'database/migrations/' || regexp_replace(k.name, '\.ts$', ''), 1
    from knex_migrations k
    where not exists (
      select 1
      from adonis_schema a
      where a.name = 'database/migrations/' || regexp_replace(k.name, '\.ts$', '')
    )
    order by k.id;
  end if;
end
$$;
