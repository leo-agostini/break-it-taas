import type { Knex } from 'knex';
import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import { db } from '@/infra/db/knex';
import {
  TestCase,
  TestCaseOwnerType,
  type TestType,
} from '@/domain/entities/test-case';
import type { AuthStrategy } from '@/domain/vos/auth-strategy';
import {
  ExecutionPolicy,
  type ResourceProfile,
} from '@/domain/vos/execution-policy';
import { LoadProfile, type LoadMode } from '@/domain/vos/load-profile';
import { Step, type StepCheck, type HttpMethod } from '@/domain/vos/step';
import { TargetSystem } from '@/domain/vos/target-system';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';

type TestCaseRow = {
  id: UUID;
  name: string;
  description: string | null;
  owner_type: TestCaseOwnerType;
  owner_id: UUID;
  test_type: TestType;
  target_system: {
    baseUrl: string;
    environment: string;
  };
  auth_strategy: AuthStrategy;
  load_profile: {
    mode: LoadMode;
    config: Record<string, unknown>;
  };
  threshold_policy: {
    maxErrorRate?: number;
    maxP95ResponseTimeMs?: number;
    maxP99ResponseTimeMs?: number;
    minCheckSuccessRate?: number;
    abortOnFail?: boolean;
  };
  execution_policy: {
    resourceProfile: ResourceProfile;
    timeoutSeconds: number;
    cpuMillicores?: number;
    memoryMb?: number;
  };
  steps: Array<{
    path: string;
    method: HttpMethod;
    checks: StepCheck[];
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  }>;
  created_at: Date;
};

const TEST_CASES_TABLE = 'test_cases';

const contextOrDb = (tx?: TransactionContext): Knex | Knex.Transaction => {
  return (tx as Knex.Transaction | undefined) ?? db;
};

const toEntity = (row: TestCaseRow): TestCase => {
  const targetSystem = new TargetSystem(
    row.target_system.baseUrl,
    row.target_system.environment,
  );

  const thresholdPolicy = new ThresholdPolicy(
    row.threshold_policy.maxErrorRate,
    row.threshold_policy.maxP95ResponseTimeMs,
    row.threshold_policy.maxP99ResponseTimeMs,
    row.threshold_policy.minCheckSuccessRate,
    row.threshold_policy.abortOnFail ?? false,
  );

  const executionPolicy = new ExecutionPolicy(
    row.execution_policy.resourceProfile,
    row.execution_policy.timeoutSeconds,
    row.execution_policy.cpuMillicores,
    row.execution_policy.memoryMb,
  );

  const loadProfile = LoadProfile.create(
    row.load_profile.mode,
    row.load_profile.config as never,
  );

  const stepRows = Array.isArray(row.steps) ? row.steps : [];
  const steps = stepRows.map((step) => {
    return new Step(
      step.path,
      step.method,
      step.checks,
      step.body,
      step.headers,
    );
  });

  return new TestCase({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    testType: row.test_type,
    targetSystem,
    authStrategy: row.auth_strategy,
    loadProfile,
    thresholdPolicy,
    executionPolicy,
    steps,
    createdAt: row.created_at,
  });
};

export class KnexTestCaseRepository implements TestCaseRepository {
  async find(id: string): Promise<TestCase | null> {
    const row = await db<TestCaseRow>(TEST_CASES_TABLE).where({ id }).first();
    if (!row) return null;
    return toEntity(row);
  }

  async findOwnedByActor(args: {
    testCaseId: string;
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestCase | null> {
    const row = await db<TestCaseRow>(TEST_CASES_TABLE)
      .where({ id: args.testCaseId })
      .andWhere((query) => {
        query
          .where({
            owner_type: TestCaseOwnerType.USER,
            owner_id: args.actorUserId,
          })
          .orWhere({
            owner_type: TestCaseOwnerType.ORGANIZATION,
            owner_id: args.actorOrgId,
          });
      })
      .first();

    if (!row) return null;
    return toEntity(row);
  }

  async create(testCase: TestCase, tx?: TransactionContext): Promise<void> {
    const conn = contextOrDb(tx);

    await conn<TestCaseRow>(TEST_CASES_TABLE).insert({
      id: testCase.id,
      name: testCase.name,
      description: testCase.description ?? null,
      owner_type: testCase.ownerType,
      owner_id: testCase.ownerId,
      test_type: testCase.testType,
      target_system: conn.raw('?::jsonb', [JSON.stringify(testCase.targetSystem)]),
      auth_strategy: conn.raw('?::jsonb', [JSON.stringify(testCase.authStrategy)]),
      load_profile: conn.raw('?::jsonb', [JSON.stringify(testCase.loadProfile)]),
      threshold_policy: conn.raw('?::jsonb', [JSON.stringify(testCase.thresholdPolicy)]),
      execution_policy: conn.raw('?::jsonb', [JSON.stringify(testCase.executionPolicy)]),
      steps: conn.raw('?::jsonb', [JSON.stringify(testCase.steps)]),
      created_at: testCase.createdAt,
    });
  }
}
