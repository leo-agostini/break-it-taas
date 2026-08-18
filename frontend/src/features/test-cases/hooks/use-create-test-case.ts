import { createTestCase } from '@/features/test-cases/api/test-cases';
import type {
  CreateTestCaseResult,
  NewTestCaseInput,
} from '@/features/test-cases/types/test-case';
import useSWRMutation from 'swr/mutation';

export function useCreateTestCase() {
  const { trigger, isMutating, error } = useSWRMutation<
    CreateTestCaseResult,
    Error,
    'test-cases',
    NewTestCaseInput
  >('test-cases', (_key, { arg }) => createTestCase(arg));

  return { createTestCase: trigger, isCreating: isMutating, error };
}
