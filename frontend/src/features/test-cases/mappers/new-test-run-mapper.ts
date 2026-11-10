import {
  toExecutionPolicy,
  toLoad,
} from '@/features/test-cases/mappers/run-configuration-mapper';
import type { RunConfigurationFormValues } from '@/features/test-cases/schemas/run-configuration-schema';
import type { NewTestRunInput } from '@/features/test-cases/types/test-run';

/**
 * The load is always sent in full; the execution policy is sent field by
 * field, and a blank timeout is left out so the backend fits it to the load.
 */
export function toNewTestRunInput(
  values: RunConfigurationFormValues,
): NewTestRunInput {
  return {
    ...toLoad(values),
    executionPolicy: toExecutionPolicy(values.execution),
  };
}
