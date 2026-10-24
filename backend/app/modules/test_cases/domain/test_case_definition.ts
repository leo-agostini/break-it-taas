import {
  AuthorizationError,
  ValidationError,
} from '#modules/shared/domain/errors';
import type { ActorContext, UUID } from '#modules/shared/domain/types';
import { assertTimeoutCoversProfile } from './execution_policy_compatibility.js';
import {
  assertCompatibleLoadProfile,
  assertThresholdPolicyForType,
} from './load_profile_compatibility.js';
import { type LoadPreset, deriveLoadProfile } from './load_profile_presets.js';
import { TestCaseOwnerType, type TestType } from './test_type.js';
import type { AuthStrategy } from './vos/auth_strategy.js';
import {
  ExecutionPolicy,
  type ResourceProfile,
} from './vos/execution_policy.js';
import {
  type LoadMode,
  LoadProfile,
  type TimeUnit,
} from './vos/load_profile.js';
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
  loadProfile: LoadProfile<LoadMode>;
  thresholdPolicy: ThresholdPolicy;
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
  executionPolicy: {
    resourceProfile: ResourceProfile;
    timeoutSeconds: number;
    cpuMillicores?: number;
    memoryMb?: number;
  };
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

function resolveLoadProfile(draft: TestCaseDraft): LoadProfile<LoadMode> {
  // A preset derives the shape the k6 guide prescribes for this test type; an
  // explicit profile is taken as authored. Exactly one of the two is allowed.
  if (Boolean(draft.loadProfile) === Boolean(draft.loadPreset)) {
    throw new ValidationError(
      'Provide exactly one of loadProfile (explicit stages) or loadPreset (derived from the test type)',
    );
  }

  if (draft.loadPreset) {
    return deriveLoadProfile(draft.testType, draft.loadPreset);
  }

  const explicit = draft.loadProfile as NonNullable<
    TestCaseDraft['loadProfile']
  >;
  return LoadProfile.create(explicit.mode, explicit.config as never);
}

/**
 * Turns a draft into a definition, enforcing every rule that spans more than
 * one field: preset derivation, test type ↔ load mode compatibility, the
 * BREAKPOINT abort requirement, and a timeout long enough for the profile.
 */
export function buildTestCaseDefinition(
  draft: TestCaseDraft,
): TestCaseDefinition {
  const loadProfile = resolveLoadProfile(draft);
  assertCompatibleLoadProfile(draft.testType, loadProfile.mode);

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

  const executionPolicy = new ExecutionPolicy(
    draft.executionPolicy.resourceProfile,
    draft.executionPolicy.timeoutSeconds,
    draft.executionPolicy.cpuMillicores,
    draft.executionPolicy.memoryMb,
  );

  assertThresholdPolicyForType(draft.testType, thresholdPolicy);
  assertTimeoutCoversProfile(loadProfile, executionPolicy);

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
