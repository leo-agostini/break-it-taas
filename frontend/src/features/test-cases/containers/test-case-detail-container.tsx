import { TestCaseDetail } from '@/features/test-cases/components/test-case-detail';
import { useCreateTestRun } from '@/features/test-cases/hooks/use-create-test-run';
import { useTestCase } from '@/features/test-cases/hooks/use-test-case';
import { useTestCaseRuns } from '@/features/test-cases/hooks/use-test-case-runs';
import type { TestCase } from '@/features/test-cases/types/test-case';
import type { TestCaseRunSummary } from '@/features/test-cases/types/test-run';
import { getApiErrorMessage } from '@/lib/api-error';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const DEFAULT_COMPARISON_SIZE = 3;

export function TestCaseDetailContainer({
  testCaseId,
  initialTestCase,
  initialRuns,
}: {
  testCaseId: string;
  initialTestCase: TestCase;
  initialRuns: TestCaseRunSummary[];
}) {
  const { testCase } = useTestCase(testCaseId, initialTestCase);
  const { runs, mutate } = useTestCaseRuns(testCaseId, initialRuns);
  const { createTestRun, isCreating } = useCreateTestRun(testCaseId);

  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  // Latch on the first data arrival rather than on the first run that happens
  // to have metrics. Latching on "has metrics" meant a page opened while every
  // run was still queued would re-run this on each poll and overwrite whatever
  // the user had selected the moment a run finished.
  const hasChosenRef = useRef(false);

  const runList = runs ?? [];

  useEffect(() => {
    if (hasChosenRef.current || !runs) return;
    hasChosenRef.current = true;

    setSelectedRunIds(
      runs
        .filter((run) => run.metrics)
        .slice(0, DEFAULT_COMPARISON_SIZE)
        .map((run) => run.id),
    );
  }, [runs]);

  function handleToggleRun(runId: string) {
    hasChosenRef.current = true;
    setSelectedRunIds((current) =>
      current.includes(runId)
        ? current.filter((id) => id !== runId)
        : [...current, runId],
    );
  }

  async function handleStartRun() {
    try {
      await createTestRun();
      toast.success('Test run queued.');
      await mutate();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not start the test run.'));
    }
  }

  if (!testCase) return null;

  return (
    <TestCaseDetail
      testCase={testCase}
      runs={runList}
      selectedRunIds={selectedRunIds}
      onToggleRun={handleToggleRun}
      onStartRun={handleStartRun}
      isStartingRun={isCreating}
    />
  );
}
