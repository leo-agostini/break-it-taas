import { BaseSchema } from '@adonisjs/lucid/schema';

/**
 * Each run now carries the load profile and runner container it executed
 * with, so runs of the same test case can differ in load (5000 req/s, then
 * 2500, then 3750) and stay comparable. Existing runs ran with their test
 * case's configuration, so that is what they are backfilled with.
 */
export default class extends BaseSchema {
  protected tableName = 'test_runs';

  async up() {
    // A CUSTOM profile missing either size was run on the SMALL fallback by
    // the old runner, and preset profiles never used a custom size. Make the
    // stored policies say what actually ran, so they pass the stricter
    // ExecutionPolicy rules when rebuilt.
    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE test_cases
        SET execution_policy = (execution_policy - 'cpuMillicores' - 'memoryMb')
          || CASE
               WHEN execution_policy->>'resourceProfile' = 'CUSTOM'
                 THEN '{"resourceProfile": "SMALL"}'::jsonb
               ELSE '{}'::jsonb
             END
        WHERE (execution_policy->>'resourceProfile' <> 'CUSTOM'
               AND (execution_policy->'cpuMillicores' IS NOT NULL
                    OR execution_policy->'memoryMb' IS NOT NULL))
           OR (execution_policy->>'resourceProfile' = 'CUSTOM'
               AND (execution_policy->'cpuMillicores' IS NULL
                    OR execution_policy->'memoryMb' IS NULL))
      `);
    });

    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('load_profile').nullable();
      table.jsonb('execution_policy').nullable();
    });

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE test_runs
        SET load_profile = test_cases.load_profile,
            execution_policy = test_cases.execution_policy
        FROM test_cases
        WHERE test_cases.id = test_runs.test_case_id
      `);
    });

    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('load_profile').notNullable().alter();
      table.jsonb('execution_policy').notNullable().alter();
    });
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('load_profile');
      table.dropColumn('execution_policy');
    });
  }
}
