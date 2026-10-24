import { BaseModel, beforeCreate, column, hasMany } from '@adonisjs/lucid/orm';
import type { HasMany } from '@adonisjs/lucid/types/relations';
import type { DateTime } from 'luxon';
import { newId } from '#modules/shared/domain/ids';
import type { UUID } from '#modules/shared/domain/types';
import { jsonb } from '#modules/shared/models/columns';
import type { TestCaseDefinition } from '../domain/test_case_definition.js';
import type { TestCaseOwnerType, TestType } from '../domain/test_type.js';
import type { AuthStrategy } from '../domain/vos/auth_strategy.js';
import {
  ExecutionPolicy,
  type ResourceProfile,
} from '../domain/vos/execution_policy.js';
import { type LoadMode, LoadProfile } from '../domain/vos/load_profile.js';
import { type HttpMethod, Step, type StepCheck } from '../domain/vos/step.js';
import { TargetSystem } from '../domain/vos/target_system.js';
import { ThresholdPolicy } from '../domain/vos/threshold_policy.js';
import TestRun from './test_run.js';

type StoredLoadProfile = { mode: LoadMode; config: Record<string, unknown> };
type StoredThresholdPolicy = {
  maxErrorRate?: number;
  maxP95ResponseTimeMs?: number;
  maxP99ResponseTimeMs?: number;
  minCheckSuccessRate?: number;
  abortOnFail?: boolean;
};
type StoredExecutionPolicy = {
  resourceProfile: ResourceProfile;
  timeoutSeconds: number;
  cpuMillicores?: number;
  memoryMb?: number;
};
type StoredStep = {
  path: string;
  method: HttpMethod;
  checks: StepCheck[];
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

/**
 * Persistence for a test case. The value objects are stored as jsonb and
 * rebuilt by `toDefinition()`; the rules that make a definition valid live in
 * `domain/test_case_definition.ts`, never here.
 */
export default class TestCase extends BaseModel {
  static selfAssignPrimaryKey = true;

  @column({ isPrimary: true })
  declare id: UUID;

  @column()
  declare name: string;

  @column()
  declare description: string | null;

  @column()
  declare ownerType: TestCaseOwnerType;

  @column()
  declare ownerId: UUID;

  @column()
  declare testType: TestType;

  @column(jsonb)
  declare targetSystem: { baseUrl: string; environment: string };

  @column(jsonb)
  declare authStrategy: AuthStrategy;

  @column(jsonb)
  declare loadProfile: StoredLoadProfile;

  @column(jsonb)
  declare thresholdPolicy: StoredThresholdPolicy;

  @column(jsonb)
  declare executionPolicy: StoredExecutionPolicy;

  @column(jsonb)
  declare steps: StoredStep[];

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @hasMany(() => TestRun)
  declare runs: HasMany<typeof TestRun>;

  @beforeCreate()
  static assignId(testCase: TestCase) {
    testCase.id ??= newId();
  }

  static fromDefinition(definition: TestCaseDefinition): TestCase {
    const testCase = new TestCase();
    testCase.fill({
      name: definition.name,
      description: definition.description ?? null,
      ownerType: definition.ownerType,
      ownerId: definition.ownerId,
      testType: definition.testType,
      // Round-trip through JSON so class instances are stored as the plain
      // objects they serialize to.
      targetSystem: JSON.parse(JSON.stringify(definition.targetSystem)),
      authStrategy: definition.authStrategy,
      loadProfile: JSON.parse(JSON.stringify(definition.loadProfile)),
      thresholdPolicy: JSON.parse(JSON.stringify(definition.thresholdPolicy)),
      executionPolicy: JSON.parse(JSON.stringify(definition.executionPolicy)),
      steps: JSON.parse(JSON.stringify(definition.steps)),
    });
    return testCase;
  }

  /** Rebuilds the domain value objects from the stored columns. */
  toDefinition(): TestCaseDefinition {
    return {
      name: this.name,
      description: this.description ?? undefined,
      ownerType: this.ownerType,
      ownerId: this.ownerId,
      testType: this.testType,
      targetSystem: new TargetSystem(
        this.targetSystem.baseUrl,
        this.targetSystem.environment,
      ),
      authStrategy: this.authStrategy,
      loadProfile: LoadProfile.create(
        this.loadProfile.mode,
        this.loadProfile.config as never,
      ),
      thresholdPolicy: new ThresholdPolicy(
        this.thresholdPolicy.maxErrorRate,
        this.thresholdPolicy.maxP95ResponseTimeMs,
        this.thresholdPolicy.maxP99ResponseTimeMs,
        this.thresholdPolicy.minCheckSuccessRate,
        this.thresholdPolicy.abortOnFail ?? false,
      ),
      executionPolicy: new ExecutionPolicy(
        this.executionPolicy.resourceProfile,
        this.executionPolicy.timeoutSeconds,
        this.executionPolicy.cpuMillicores,
        this.executionPolicy.memoryMb,
      ),
      steps: (Array.isArray(this.steps) ? this.steps : []).map(
        (step) =>
          new Step(
            step.path,
            step.method,
            step.checks,
            step.body,
            step.headers,
          ),
      ),
    };
  }
}
