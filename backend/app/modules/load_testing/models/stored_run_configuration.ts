import type { RunConfiguration } from '../domain/run_configuration.js';
import {
  ExecutionPolicy,
  type ResourceProfile,
} from '../domain/vos/execution_policy.js';
import { type LoadMode, LoadProfile } from '../domain/vos/load_profile.js';

/*
| The jsonb shape of a run configuration, shared by `test_cases` (the default)
| and `test_runs` (what each run executed with).
*/

export type StoredLoadProfile = {
  mode: LoadMode;
  config: Record<string, unknown>;
};

export type StoredExecutionPolicy = {
  resourceProfile: ResourceProfile;
  timeoutSeconds: number;
  cpuMillicores?: number;
  memoryMb?: number;
};

export function toStoredRunConfiguration(config: RunConfiguration): {
  loadProfile: StoredLoadProfile;
  executionPolicy: StoredExecutionPolicy;
} {
  // Round-trip through JSON so class instances are stored as the plain
  // objects they serialize to.
  return {
    loadProfile: JSON.parse(JSON.stringify(config.loadProfile)),
    executionPolicy: JSON.parse(JSON.stringify(config.executionPolicy)),
  };
}

export function fromStoredLoadProfile(
  stored: StoredLoadProfile,
): LoadProfile<LoadMode> {
  return LoadProfile.create(stored.mode, stored.config as never);
}

export function fromStoredExecutionPolicy(
  stored: StoredExecutionPolicy,
): ExecutionPolicy {
  return new ExecutionPolicy(
    stored.resourceProfile,
    stored.timeoutSeconds,
    stored.cpuMillicores,
    stored.memoryMb,
  );
}
