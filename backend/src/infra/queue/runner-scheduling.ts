import { ConfigurationError } from '@/domain/errors/custom-errors';

/**
 * Scheduling constraints applied to runner Jobs.
 *
 * Both fields are environment-specific and therefore optional. Local kind
 * clusters leave them unset — kind has no sandboxed runtime class and a single
 * homogeneous node pool. Managed clusters set them to pin runners onto isolated
 * nodes (for example GKE Sandbox: RUNNER_RUNTIME_CLASS=gvisor with
 * RUNNER_NODE_SELECTOR=sandbox.gke.io/runtime=gvisor).
 *
 * Keeping them out of the manifest means one Job template works everywhere,
 * with only the environment config swapped.
 */
export type RunnerScheduling = {
  runtimeClassName?: string;
  nodeSelector?: Record<string, string>;
};

/**
 * Parses a `key=value,key2=value2` node selector string.
 *
 * Throws rather than skipping malformed entries: a silently dropped selector
 * would schedule runner pods onto nodes the operator meant to exclude.
 */
export function parseNodeSelector(
  raw: string | undefined,
): Record<string, string> | undefined {
  if (!raw?.trim()) {
    return undefined;
  }

  const selector: Record<string, string> = {};

  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      throw new ConfigurationError(
        `Invalid RUNNER_NODE_SELECTOR entry "${trimmed}": expected key=value.`,
      );
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || !value) {
      throw new ConfigurationError(
        `Invalid RUNNER_NODE_SELECTOR entry "${trimmed}": key and value are both required.`,
      );
    }

    selector[key] = value;
  }

  return Object.keys(selector).length > 0 ? selector : undefined;
}

/**
 * Deliberately takes its inputs rather than reading `env` directly, so the
 * module stays pure and the composition root owns configuration.
 */
export function resolveRunnerScheduling(
  runtimeClassName: string | undefined,
  nodeSelector: string | undefined,
): RunnerScheduling {
  const scheduling: RunnerScheduling = {};

  if (runtimeClassName?.trim()) {
    scheduling.runtimeClassName = runtimeClassName.trim();
  }

  const parsedSelector = parseNodeSelector(nodeSelector);
  if (parsedSelector) {
    scheduling.nodeSelector = parsedSelector;
  }

  return scheduling;
}
