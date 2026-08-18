import { getTestRunReport } from '@/features/test-cases/api/test-runs';
import {
  RUN_POLL_INTERVAL_MS,
  isTerminal,
} from '@/features/test-cases/lib/status';
import type {
  TestRunReport,
  TestRunStatus,
} from '@/features/test-cases/types/test-run';
import { useEffect, useRef } from 'react';
import useSWR from 'swr';

export function useTestRunReport(
  testRunId: string,
  options: { runStatus: TestRunStatus; initialData?: TestRunReport | null },
) {
  const isActive = !isTerminal(options.runStatus);

  const { data, error, isLoading, mutate } = useSWR<TestRunReport | null>(
    ['test-run-report', testRunId],
    () => getTestRunReport(testRunId),
    {
      fallbackData: options.initialData,
      refreshInterval: isActive ? RUN_POLL_INTERVAL_MS : 0,
    },
  );

  // The last report poll can 404 moments before the runner callback commits;
  // once the run reaches a terminal status polling stops, so without this the
  // page would keep showing "no metrics yet" on a finished run. Status and
  // metrics are written in the same backend transaction, so one refetch on the
  // transition is enough.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (wasActive.current && !isActive) {
      void mutate();
    }
    wasActive.current = isActive;
  }, [isActive, mutate]);

  return { report: data, error, isLoading, mutate };
}
