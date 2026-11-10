import {
  BaseModel,
  beforeCreate,
  belongsTo,
  column,
} from '@adonisjs/lucid/orm';
import type { BelongsTo } from '@adonisjs/lucid/types/relations';
import { DateTime } from 'luxon';
import { newId } from '#modules/shared/domain/ids';
import type { UUID } from '#modules/shared/domain/types';
import { jsonb } from '#modules/shared/models/columns';
import type { RunConfiguration } from '../domain/run_configuration.js';
import {
  type CompletionStatus,
  TestRunStatus,
  completeTransition,
  queueTransition,
  startTransition,
} from '../domain/test_run_status.js';
import {
  type StoredExecutionPolicy,
  type StoredLoadProfile,
  fromStoredExecutionPolicy,
  fromStoredLoadProfile,
  toStoredRunConfiguration,
} from './stored_run_configuration.js';
import TestCase from './test_case.js';

/**
 * A single execution of a test case, at the load and on the container stored
 * with it. Status changes go through the methods
 * below, which delegate the legality check to the pure lifecycle in
 * `domain/test_run_status.ts` and only stamp timestamps themselves.
 */
export default class TestRun extends BaseModel {
  static selfAssignPrimaryKey = true;

  @column({ isPrimary: true })
  declare id: UUID;

  @column()
  declare testCaseId: UUID;

  @column()
  declare status: TestRunStatus;

  @column.dateTime()
  declare startedAt: DateTime | null;

  @column.dateTime()
  declare completedAt: DateTime | null;

  @column()
  declare runtimeRef: string | null;

  /** The load this run executed with (see domain/run_configuration.ts). */
  @column(jsonb)
  declare loadProfile: StoredLoadProfile;

  /** The runner container this run executed on. */
  @column(jsonb)
  declare executionPolicy: StoredExecutionPolicy;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @belongsTo(() => TestCase)
  declare testCase: BelongsTo<typeof TestCase>;

  @beforeCreate()
  static assignId(run: TestRun) {
    run.id ??= newId();
  }

  static draft(testCaseId: UUID, config: RunConfiguration): TestRun {
    const run = new TestRun();
    const stored = toStoredRunConfiguration(config);
    run.testCaseId = testCaseId;
    run.status = TestRunStatus.CREATED;
    run.loadProfile = stored.loadProfile;
    run.executionPolicy = stored.executionPolicy;
    return run;
  }

  toRunConfiguration(): RunConfiguration {
    return {
      loadProfile: fromStoredLoadProfile(this.loadProfile),
      executionPolicy: fromStoredExecutionPolicy(this.executionPolicy),
    };
  }

  queue() {
    this.status = queueTransition(this.status);
  }

  start() {
    this.status = startTransition(this.status);
    this.startedAt = DateTime.now();
  }

  complete(outcome: CompletionStatus) {
    this.status = completeTransition(this.status, outcome);
    this.completedAt = DateTime.now();
  }
}
