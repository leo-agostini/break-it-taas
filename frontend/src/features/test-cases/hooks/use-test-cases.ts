import { listTestCases } from '@/features/test-cases/api/test-cases';
import type { TestCaseSummary } from '@/features/test-cases/types/test-case';
import useSWR from 'swr';

export function useTestCases(initialData?: TestCaseSummary[]) {
  const { data, error, isLoading, mutate } = useSWR<TestCaseSummary[]>(
    'test-cases',
    () => listTestCases(),
    { fallbackData: initialData },
  );

  return { testCases: data, error, isLoading, mutate };
}
