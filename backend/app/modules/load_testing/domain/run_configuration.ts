import { ValidationError } from '#modules/shared/domain/errors';
import {
  EXECUTION_GRACE_SECONDS,
  assertTimeoutCoversProfile,
} from './execution_policy_compatibility.js';
import { assertCompatibleLoadProfile } from './load_profile_compatibility.js';
import { loadProfileDurationSeconds } from './load_profile_duration.js';
import { type LoadPreset, deriveLoadProfile } from './load_profile_presets.js';
import type { TestType } from './test_type.js';
import {
  ExecutionPolicy,
  type ResourceProfile,
} from './vos/execution_policy.js';
import { type LoadMode, LoadProfile } from './vos/load_profile.js';

/**
 * How hard one run pushes the target, and on what: the load profile and the
 * runner container it executes in. A test case holds a default; each run keeps
 * the configuration it actually ran with, so runs of the same case at
 * different loads stay comparable.
 */
export interface RunConfiguration {
  loadProfile: LoadProfile<LoadMode>;
  executionPolicy: ExecutionPolicy;
}

export type ExecutionPolicyDraft = {
  resourceProfile: ResourceProfile;
  timeoutSeconds: number;
  cpuMillicores?: number;
  memoryMb?: number;
};

/** A run configuration as it arrives or is stored, not yet checked. */
export interface RunConfigurationDraft {
  loadProfile?: { mode: LoadMode; config: Record<string, unknown> } | null;
  loadPreset?: LoadPreset | null;
  executionPolicy: ExecutionPolicyDraft;
}

/**
 * What a request may change about a run relative to its test case's default.
 * Every field is optional; an empty override reruns the default as is.
 */
export interface RunConfigurationOverride {
  loadProfile?: { mode: LoadMode; config: Record<string, unknown> } | null;
  loadPreset?: LoadPreset | null;
  executionPolicy?: Partial<ExecutionPolicyDraft> | null;
}

function resolveLoadProfile(
  testType: TestType,
  draft: RunConfigurationDraft,
): LoadProfile<LoadMode> {
  // A preset derives the shape the k6 guide prescribes for this test type; an
  // explicit profile is taken as authored. Exactly one of the two is allowed.
  if (Boolean(draft.loadProfile) === Boolean(draft.loadPreset)) {
    throw new ValidationError(
      'Provide exactly one of loadProfile (explicit stages) or loadPreset (derived from the test type)',
    );
  }

  if (draft.loadPreset) {
    return deriveLoadProfile(testType, draft.loadPreset);
  }

  const explicit = draft.loadProfile as NonNullable<
    RunConfigurationDraft['loadProfile']
  >;
  return LoadProfile.create(explicit.mode, explicit.config as never);
}

/**
 * Turns a draft into a run configuration, enforcing the rules that tie load to
 * the test type and to the container: preset derivation, test type ↔ load
 * mode compatibility, and a timeout long enough for the profile.
 */
export function buildRunConfiguration(
  testType: TestType,
  draft: RunConfigurationDraft,
): RunConfiguration {
  const loadProfile = resolveLoadProfile(testType, draft);
  assertCompatibleLoadProfile(testType, loadProfile.mode);

  const executionPolicy = new ExecutionPolicy(
    draft.executionPolicy.resourceProfile,
    draft.executionPolicy.timeoutSeconds,
    draft.executionPolicy.cpuMillicores,
    draft.executionPolicy.memoryMb,
  );
  assertTimeoutCoversProfile(loadProfile, executionPolicy);

  return { loadProfile, executionPolicy };
}

/**
 * Applies a per-run override on top of a test case's default configuration.
 *
 * A new load replaces the default load wholesale, and a new execution policy
 * replaces the default one field by field. When the load changes but the
 * timeout is not given, the timeout grows to fit the new profile, so asking
 * for a longer run does not also require recomputing the Job deadline by hand.
 */
export function applyRunConfigurationOverride(
  testType: TestType,
  defaults: RunConfiguration,
  override: RunConfigurationOverride = {},
): RunConfiguration {
  const overridesLoad = Boolean(override.loadProfile || override.loadPreset);
  const defaultPolicy = defaults.executionPolicy;
  const requestedPolicy = override.executionPolicy ?? {};
  const resourceProfile =
    requestedPolicy.resourceProfile ?? defaultPolicy.resourceProfile;
  // CPU and memory only mean something for the profile they were set with.
  const keepsCustomSize =
    requestedPolicy.resourceProfile === undefined ||
    requestedPolicy.resourceProfile === defaultPolicy.resourceProfile;

  const draft: RunConfigurationDraft = overridesLoad
    ? {
        loadProfile: override.loadProfile ?? null,
        loadPreset: override.loadPreset ?? null,
        executionPolicy: { resourceProfile, timeoutSeconds: 0 },
      }
    : {
        loadProfile: JSON.parse(JSON.stringify(defaults.loadProfile)),
        executionPolicy: { resourceProfile, timeoutSeconds: 0 },
      };

  draft.executionPolicy.cpuMillicores =
    requestedPolicy.cpuMillicores ??
    (keepsCustomSize ? defaultPolicy.cpuMillicores : undefined);
  draft.executionPolicy.memoryMb =
    requestedPolicy.memoryMb ??
    (keepsCustomSize ? defaultPolicy.memoryMb : undefined);

  if (requestedPolicy.timeoutSeconds !== undefined) {
    draft.executionPolicy.timeoutSeconds = requestedPolicy.timeoutSeconds;
  } else if (overridesLoad) {
    const loadProfile = resolveLoadProfile(testType, draft);
    draft.executionPolicy.timeoutSeconds = Math.max(
      defaultPolicy.timeoutSeconds,
      loadProfileDurationSeconds(loadProfile) + EXECUTION_GRACE_SECONDS,
    );
  } else {
    draft.executionPolicy.timeoutSeconds = defaultPolicy.timeoutSeconds;
  }

  return buildRunConfiguration(testType, draft);
}
