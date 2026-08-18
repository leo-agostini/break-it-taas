import { createTestRun } from '@/features/test-cases/api/test-runs';
import type { TestRun } from '@/features/test-cases/types/test-run';
import useSWRMutation from 'swr/mutation';

export function useCreateTestRun(testCaseId: string) {
  const { trigger, isMutating, error } = useSWRMutation<
    TestRun,
    Error,
    [string, string]
  >(['create-test-run', testCaseId], () => createTestRun(testCaseId));

  return { createTestRun: trigger, isCreating: isMutating, error };
}
