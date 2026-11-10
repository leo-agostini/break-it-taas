import { AuthorizationError } from '#modules/shared/domain/errors';
import type { ActorContext, UUID } from '#modules/shared/domain/types';
import { assertThresholdPolicyForType } from './load_profile_compatibility.js';
import type { LoadPreset } from './load_profile_presets.js';
import {
  type ExecutionPolicyDraft,
  buildRunConfiguration,
} from './run_configuration.js';
import { TestCaseOwnerType, type TestType } from './test_type.js';
import type { AuthStrategy } from './vos/auth_strategy.js';
import type { ExecutionPolicy } from './vos/execution_policy.js';
import type { LoadMode, LoadProfile, TimeUnit } from './vos/load_profile.js';
import { type HttpMethod, Step, type StepCheck } from './vos/step.js';
import { TargetSystem } from './vos/target_system.js';
import { ThresholdPolicy } from './vos/threshold_policy.js';

/**
 * Everything that defines a load test, independent of how it is stored or
 * which engine runs it (ADR-002). Built only through
 * `buildTestCaseDefinition`, so every instance has passed the type/profile
 * compatibility rules.
 */
export interface TestCaseDefinition {
  name: string;
  description?: string;
  ownerType: TestCaseOwnerType;
  ownerId: UUID;
  testType: TestType;
  targetSystem: TargetSystem;
  authStrategy: AuthStrategy;
  /** Default load for runs that do not override it. */
  loadProfile: LoadProfile<LoadMode>;
  thresholdPolicy: ThresholdPolicy;
  /** Default runner container for runs that do not override it. */
  executionPolicy: ExecutionPolicy;
  steps: Step[];
}

/**
 * The shape of a test case as it arrives (request) or is read back (row):
 * structurally valid, not yet checked against the domain rules.
 */
export interface TestCaseDraft {
  name: string;
  description?: string | null;
  ownerType: TestCaseOwnerType;
  ownerId: UUID;
  testType: TestType;
  targetSystem: { baseUrl: string; environment: string };
  authStrategy: AuthStrategy;
  loadProfile?: { mode: LoadMode; config: Record<string, unknown> } | null;
  loadPreset?: LoadPreset | null;
  thresholdPolicy: {
    maxErrorRate?: number;
    maxP95ResponseTimeMs?: number;
    maxP99ResponseTimeMs?: number;
    minCheckSuccessRate?: number;
    abortOnFail?: boolean;
  };
  executionPolicy: ExecutionPolicyDraft;
  steps?: Array<{
    path: string;
    method: HttpMethod;
    checks?: StepCheck[];
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  }>;
}

export type { LoadPreset, TimeUnit };

/**
 * A test case may only be created in the name of the caller, or of the
 * caller's organization.
 */
export function assertActorMayOwn(
  owner: { ownerType: TestCaseOwnerType; ownerId: UUID },
  actor: ActorContext,
): void {
  const allowedOwnerId =
    owner.ownerType === TestCaseOwnerType.ORGANIZATION
      ? actor.orgId
      : actor.userId;

  if (owner.ownerId !== allowedOwnerId) {
    throw new AuthorizationError();
  }
}

/**
 * Turns a draft into a definition, enforcing every rule that spans more than
 * one field: the default run configuration's rules (see
 * `buildRunConfiguration`) and the BREAKPOINT abort requirement.
 */
export function buildTestCaseDefinition(
  draft: TestCaseDraft,
): TestCaseDefinition {
  const { loadProfile, executionPolicy } = buildRunConfiguration(
    draft.testType,
    draft,
  );

  const targetSystem = new TargetSystem(
    draft.targetSystem.baseUrl,
    draft.targetSystem.environment,
  );

  const thresholdPolicy = new ThresholdPolicy(
    draft.thresholdPolicy.maxErrorRate,
    draft.thresholdPolicy.maxP95ResponseTimeMs,
    draft.thresholdPolicy.maxP99ResponseTimeMs,
    draft.thresholdPolicy.minCheckSuccessRate,
    draft.thresholdPolicy.abortOnFail ?? false,
  );

  assertThresholdPolicyForType(draft.testType, thresholdPolicy);

  return {
    name: draft.name,
    description: draft.description ?? undefined,
    ownerType: draft.ownerType,
    ownerId: draft.ownerId,
    testType: draft.testType,
    targetSystem,
    authStrategy: draft.authStrategy,
    loadProfile,
    thresholdPolicy,
    executionPolicy,
    steps: (draft.steps ?? []).map(
      (step) =>
        new Step(
          step.path,
          step.method,
          step.checks ?? [],
          step.body,
          step.headers,
        ),
    ),
  };
}
