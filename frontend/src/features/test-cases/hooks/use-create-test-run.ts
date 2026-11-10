import { createTestRun } from '@/features/test-cases/api/test-runs';
import type {
  NewTestRunInput,
  TestRun,
} from '@/features/test-cases/types/test-run';
import useSWRMutation from 'swr/mutation';

export function useCreateTestRun(testCaseId: string) {
  const { trigger, isMutating, error } = useSWRMutation<
    TestRun,
    Error,
    [string, string],
    NewTestRunInput | undefined
  >(['create-test-run', testCaseId], (_key, { arg }) =>
    createTestRun(testCaseId, arg),
  );

  return { createTestRun: trigger, isCreating: isMutating, error };
}
