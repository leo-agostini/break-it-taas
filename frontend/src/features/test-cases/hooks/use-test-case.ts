import { getTestCase } from '@/features/test-cases/api/test-cases';
import type { TestCase } from '@/features/test-cases/types/test-case';
import useSWR from 'swr';

export function useTestCase(testCaseId: string, initialData?: TestCase) {
  const { data, error, isLoading, mutate } = useSWR<TestCase>(
    ['test-case', testCaseId],
    () => getTestCase(testCaseId),
    { fallbackData: initialData },
  );

  return { testCase: data, error, isLoading, mutate };
}
