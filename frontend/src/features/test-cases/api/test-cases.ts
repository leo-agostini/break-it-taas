import type {
  CreateTestCaseResult,
  NewTestCaseInput,
  TestCase,
  TestCaseSummary,
} from '@/features/test-cases/types/test-case';
import { privateHttpClient } from '@/lib/httpClient';
import type { AxiosInstance } from 'axios';

export async function listTestCases(
  client: AxiosInstance = privateHttpClient,
): Promise<TestCaseSummary[]> {
  const response = await client.get<TestCaseSummary[]>('/test-cases');
  return response.data;
}

export async function getTestCase(
  testCaseId: string,
  client: AxiosInstance = privateHttpClient,
): Promise<TestCase> {
  const response = await client.get<TestCase>(`/test-cases/${testCaseId}`);
  return response.data;
}

export async function createTestCase(
  payload: NewTestCaseInput,
  client: AxiosInstance = privateHttpClient,
): Promise<CreateTestCaseResult> {
  const response = await client.post<CreateTestCaseResult>(
    '/test-cases',
    payload,
  );
  return response.data;
}
