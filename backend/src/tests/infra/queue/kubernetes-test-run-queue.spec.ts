import { describe, expect, it } from 'bun:test';
import { TestRun } from '@/domain/entities/test-run';

describe('KubernetesTestRunQueue', () => {
  it('returns runtimeRef from created job metadata', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    process.env.RUNNER_SHARED_SECRET =
      process.env.RUNNER_SHARED_SECRET ?? 'runner-secret';
    process.env.RUNNER_CALLBACK_BASE_URL =
      process.env.RUNNER_CALLBACK_BASE_URL ?? 'http://localhost:3001';

    const { KubernetesTestRunQueue } = await import(
      '@/infra/queue/kubernetes-test-run-queue'
    );

    const queue = new KubernetesTestRunQueue({
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

  it('sends the test type to the runner so it can apply per-type behavior', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    process.env.RUNNER_SHARED_SECRET =
      process.env.RUNNER_SHARED_SECRET ?? 'runner-secret';
    process.env.RUNNER_CALLBACK_BASE_URL =
      process.env.RUNNER_CALLBACK_BASE_URL ?? 'http://localhost:3001';

    const { KubernetesTestRunQueue } = await import(
      '@/infra/queue/kubernetes-test-run-queue'
    );

    let createdJob: Record<string, never> | undefined;
    const queue = new KubernetesTestRunQueue({
      createJob: async (_namespace: string, job: Record<string, never>) => {
        createdJob = job;
        return { metadata: { uid: 'job-uid-2', name: 'testrun-b' } };
      },
      getJob: async () => ({ metadata: { name: 'testrun-b' } }),
    } as never);

    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    const testCase = {
      id: run.testCaseId,
      testType: 'BREAKPOINT',
      targetSystem: { baseUrl: 'https://example.com', environment: 'staging' },
      authStrategy: { kind: 'NONE' },
      loadProfile: {
        mode: 'RAMP',
        config: {
          initialRate: 0,
          timeUnit: 'SECONDS',
          stages: [{ target: 500, duration: 30 }],
        },
      },
      thresholdPolicy: { abortOnFail: true, maxP95ResponseTimeMs: 500 },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 90 },
      steps: [],
    } as never;

    await queue.publish(run, testCase);

    const env = (
      createdJob as unknown as {
        spec: {
          template: {
            spec: {
              containers: Array<{
                env: Array<{ name: string; value: string }>;
              }>;
            };
          };
        };
      }
    ).spec.template.spec.containers[0].env;
    const runConfig = JSON.parse(
      env.find((item) => item.name === 'RUN_CONFIG_JSON')?.value ?? '{}',
    );

    expect(runConfig.testType).toBe('BREAKPOINT');
  });

  it('omits runtimeClassName and nodeSelector when unconfigured (kind)', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    process.env.RUNNER_SHARED_SECRET =
      process.env.RUNNER_SHARED_SECRET ?? 'runner-secret';
    process.env.RUNNER_CALLBACK_BASE_URL =
      process.env.RUNNER_CALLBACK_BASE_URL ?? 'http://localhost:3001';

    const { KubernetesTestRunQueue } = await import(
      '@/infra/queue/kubernetes-test-run-queue'
    );

    let submitted: Record<string, unknown> | undefined;
    const queue = new KubernetesTestRunQueue(
      {
        createJob: async (_ns: string, job: Record<string, unknown>) => {
          submitted = job;
          return { metadata: { uid: 'job-uid-2' } };
        },
        getJob: async () => ({ metadata: { name: 'testrun-a' } }),
      } as never,
      {},
    );

    await queue.publish(TestRun.create({ testCaseId: crypto.randomUUID() }), {
      id: crypto.randomUUID(),
      targetSystem: { baseUrl: 'https://example.com', environment: 'staging' },
      authStrategy: { kind: 'NONE' },
      loadProfile: {
        mode: 'CONSTANT',
        config: { duration: 10, targetRate: 1, timeUnit: 'SECONDS' },
      },
      thresholdPolicy: { abortOnFail: false },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 30 },
      steps: [],
    } as never);

    const podSpec = (
      submitted as never as {
        spec: { template: { spec: Record<string, unknown> } };
      }
    ).spec.template.spec;

    expect(podSpec).not.toHaveProperty('runtimeClassName');
    expect(podSpec).not.toHaveProperty('nodeSelector');
  });

  it('applies runtimeClassName and nodeSelector when configured (GKE)', async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
    process.env.RUNNER_SHARED_SECRET =
      process.env.RUNNER_SHARED_SECRET ?? 'runner-secret';
    process.env.RUNNER_CALLBACK_BASE_URL =
      process.env.RUNNER_CALLBACK_BASE_URL ?? 'http://localhost:3001';

    const { KubernetesTestRunQueue } = await import(
      '@/infra/queue/kubernetes-test-run-queue'
    );

    let submitted: Record<string, unknown> | undefined;
    const queue = new KubernetesTestRunQueue(
      {
        createJob: async (_ns: string, job: Record<string, unknown>) => {
          submitted = job;
          return { metadata: { uid: 'job-uid-3' } };
        },
        getJob: async () => ({ metadata: { name: 'testrun-a' } }),
      } as never,
      {
        runtimeClassName: 'gvisor',
        nodeSelector: { 'sandbox.gke.io/runtime': 'gvisor' },
      },
    );

    await queue.publish(TestRun.create({ testCaseId: crypto.randomUUID() }), {
      id: crypto.randomUUID(),
      targetSystem: { baseUrl: 'https://example.com', environment: 'staging' },
      authStrategy: { kind: 'NONE' },
      loadProfile: {
        mode: 'CONSTANT',
        config: { duration: 10, targetRate: 1, timeUnit: 'SECONDS' },
      },
      thresholdPolicy: { abortOnFail: false },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 30 },
      steps: [],
    } as never);

    const podSpec = (
      submitted as never as {
        spec: { template: { spec: Record<string, unknown> } };
      }
    ).spec.template.spec;

    expect(podSpec.runtimeClassName).toBe('gvisor');
    expect(podSpec.nodeSelector).toEqual({
      'sandbox.gke.io/runtime': 'gvisor',
    });
  });
});
