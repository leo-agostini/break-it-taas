import type {
  TestCaseRunSummary,
  TestRun,
  TestRunReport,
} from '@/features/test-cases/types/test-run';
import { isNotFound } from '@/lib/api-error';
import { privateHttpClient } from '@/lib/httpClient';
import type { AxiosInstance } from 'axios';

export async function listTestCaseRuns(
  testCaseId: string,
  client: AxiosInstance = privateHttpClient,
): Promise<TestCaseRunSummary[]> {
  const response = await client.get<TestCaseRunSummary[]>(
    `/test-cases/${testCaseId}/runs`,
  );
  return response.data;
}

export async function getTestRun(
  testRunId: string,
  client: AxiosInstance = privateHttpClient,
): Promise<TestRun> {
  const response = await client.get<TestRun>(`/test-runs/${testRunId}`);
  return response.data;
}

// Metrics only exist once the runner reports back, so an in-progress run has no
// report yet and the backend answers 404 — that is an expected state, not a failure.
export async function getTestRunReport(
  testRunId: string,
  client: AxiosInstance = privateHttpClient,
): Promise<TestRunReport | null> {
  try {
    const response = await client.get<TestRunReport>(
      `/test-runs/${testRunId}/report`,
    );
    return response.data;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function createTestRun(
  testCaseId: string,
  client: AxiosInstance = privateHttpClient,
): Promise<TestRun> {
  const response = await client.post<TestRun>(`/test-runs/${testCaseId}`);
  return response.data;
}
