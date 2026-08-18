import { listTestCaseRuns } from '@/features/test-cases/api/test-runs';
import {
  RUN_POLL_INTERVAL_MS,
  hasActiveRun,
} from '@/features/test-cases/lib/status';
import type { TestCaseRunSummary } from '@/features/test-cases/types/test-run';
import { useState } from 'react';
import useSWR from 'swr';

export function useTestCaseRuns(
  testCaseId: string,
  initialData?: TestCaseRunSummary[],
) {
  // SWR keeps `refreshInterval` in its polling effect's dependency array, so a
  // function value (new identity each render) would clear and re-arm the timer
  // on every render and could starve the poll entirely. A number only changes
  // on the active -> terminal transition, which is exactly when we want the
  // effect to re-run.
  const [refreshInterval, setRefreshInterval] = useState(() =>
    hasActiveRun(initialData) ? RUN_POLL_INTERVAL_MS : 0,
  );

  const { data, error, isLoading, mutate } = useSWR<TestCaseRunSummary[]>(
    ['test-case-runs', testCaseId],
    () => listTestCaseRuns(testCaseId),
    { fallbackData: initialData, refreshInterval },
  );

  const nextInterval = hasActiveRun(data) ? RUN_POLL_INTERVAL_MS : 0;
  if (nextInterval !== refreshInterval) {
    setRefreshInterval(nextInterval);
  }

  return { runs: data, error, isLoading, mutate };
}
