import { describe, expect, it } from 'bun:test';
import { TestRun } from '@/domain/entities/test-run';

describe('K3sTestRunQueue', () => {
  it('returns runtimeRef from created job metadata', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    process.env.RUNNER_SHARED_SECRET =
      process.env.RUNNER_SHARED_SECRET ?? 'runner-secret';
    process.env.RUNNER_CALLBACK_BASE_URL =
      process.env.RUNNER_CALLBACK_BASE_URL ?? 'http://localhost:3001';

    const { K3sTestRunQueue } = await import(
      '@/infra/queue/k3s-test-run-queue'
    );

    const queue = new K3sTestRunQueue({
      createJob: async () => ({
        metadata: { uid: 'job-uid-1', name: 'testrun-a' },
      }),
      getJob: async () => ({ metadata: { name: 'testrun-a' } }),
    } as never);

    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    const testCase = {
      id: run.testCaseId,
      targetSystem: { baseUrl: 'https://example.com', environment: 'staging' },
      authStrategy: { kind: 'NONE' },
      loadProfile: {
        mode: 'CONSTANT',
        config: { duration: 10, targetRate: 1, timeUnit: 'SECONDS' },
      },
      thresholdPolicy: { abortOnFail: false },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 30 },
      steps: [],
    } as never;

    const published = await queue.publish(run, testCase);
    expect(published.runtimeRef).toBe('job-uid-1');
  });
});
