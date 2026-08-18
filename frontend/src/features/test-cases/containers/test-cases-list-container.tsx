import { TestCasesList } from '@/features/test-cases/components/test-cases-list';
import { useTestCases } from '@/features/test-cases/hooks/use-test-cases';
import type { TestCaseSummary } from '@/features/test-cases/types/test-case';

export function TestCasesListContainer({
  initialData,
}: {
  initialData: TestCaseSummary[];
}) {
  const { testCases, isLoading } = useTestCases(initialData);

  return <TestCasesList testCases={testCases ?? []} isLoading={isLoading} />;
}
