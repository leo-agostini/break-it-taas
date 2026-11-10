import { TestCaseDetail } from '@/features/test-cases/components/test-case-detail';
import { useCreateTestRun } from '@/features/test-cases/hooks/use-create-test-run';
import { useTestCase } from '@/features/test-cases/hooks/use-test-case';
import { useTestCaseRuns } from '@/features/test-cases/hooks/use-test-case-runs';
import { toNewTestRunInput } from '@/features/test-cases/mappers/new-test-run-mapper';
import type { RunConfigurationFormValues } from '@/features/test-cases/schemas/run-configuration-schema';
import type { TestCase } from '@/features/test-cases/types/test-case';
import type {
  NewTestRunInput,
  TestCaseRunSummary,
} from '@/features/test-cases/types/test-run';
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
  const [isConfiguringRun, setIsConfiguringRun] = useState(false);
  const [runConfigError, setRunConfigError] = useState<string | null>(null);
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

  async function startRun(override?: NewTestRunInput): Promise<boolean> {
    try {
      await createTestRun(override);
      toast.success('Test run queued.');
      await mutate();
      return true;
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        'Could not start the test run.',
      );
      toast.error(message);
      if (override) setRunConfigError(message);
      return false;
    }
  }

  function handleOpenRunConfig(open: boolean) {
    setRunConfigError(null);
    setIsConfiguringRun(open);
  }

  async function handleStartConfiguredRun(values: RunConfigurationFormValues) {
    setRunConfigError(null);
    if (await startRun(toNewTestRunInput(values))) {
      setIsConfiguringRun(false);
    }
  }

  if (!testCase) return null;

  return (
    <TestCaseDetail
      testCase={testCase}
      runs={runList}
      selectedRunIds={selectedRunIds}
      onToggleRun={handleToggleRun}
      onStartRun={() => startRun()}
      isStartingRun={isCreating}
      runConfig={{
        open: isConfiguringRun,
        onOpenChange: handleOpenRunConfig,
        submitError: runConfigError,
        onSubmit: handleStartConfiguredRun,
      }}
    />
  );
}
