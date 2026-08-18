import { getTestRun } from '@/features/test-cases/api/test-runs';
import {
  RUN_POLL_INTERVAL_MS,
  isRunActive,
} from '@/features/test-cases/lib/status';
import type { TestRun } from '@/features/test-cases/types/test-run';
import { useState } from 'react';
import useSWR from 'swr';

export function useTestRun(testRunId: string, initialData?: TestRun) {
  // See use-test-case-runs.ts — `refreshInterval` must be a stable number, not
  // a function, or SWR re-arms the timer on every render.
  const [refreshInterval, setRefreshInterval] = useState(() =>
    initialData && isRunActive(initialData) ? RUN_POLL_INTERVAL_MS : 0,
  );

  const { data, error, isLoading, mutate } = useSWR<TestRun>(
    ['test-run', testRunId],
    () => getTestRun(testRunId),
    { fallbackData: initialData, refreshInterval },
  );

  const nextInterval = data && isRunActive(data) ? RUN_POLL_INTERVAL_MS : 0;
  if (nextInterval !== refreshInterval) {
    setRefreshInterval(nextInterval);
  }

  return { testRun: data, error, isLoading, mutate };
}
