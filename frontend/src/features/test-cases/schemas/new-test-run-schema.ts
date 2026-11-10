import {
  refineRunConfiguration,
  runConfigurationFormSchema,
} from '@/features/test-cases/schemas/run-configuration-schema';
import type { TestType } from '@/features/test-cases/types/test-case';

/** Which load modes are legal depends on the test case being run. */
export function newTestRunFormSchema(testType: TestType) {
  return runConfigurationFormSchema.superRefine((values, ctx) =>
    refineRunConfiguration(values, testType, ctx),
  );
}
