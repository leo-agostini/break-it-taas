import { randomUUID } from 'node:crypto';
import { test } from '@japa/runner';
import { KubernetesTestRunQueue } from '#modules/runner/kubernetes_test_run_queue';

test.group('KubernetesTestRunQueue', () => {
  test('returns runtimeRef from created job metadata', async ({ expect }) => {
    const queue = new KubernetesTestRunQueue({
      createJob: async () => ({
        metadata: { uid: 'job-uid-1', name: 'testrun-a' },
      }),
      getJob: async () => ({ metadata: { name: 'testrun-a' } }),
    } as never);

    const testRunId = randomUUID();
    const testCase = {
      id: randomUUID(),
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

    const published = await queue.publish({ testRunId, testCase });
    expect(published.runtimeRef).toBe('job-uid-1');
  });

  test('sends the test type to the runner so it can apply per-type behavior', async ({
    expect,
  }) => {
    let createdJob: Record<string, never> | undefined;
    const queue = new KubernetesTestRunQueue({
      createJob: async (_namespace: string, job: Record<string, never>) => {
        createdJob = job;
        return { metadata: { uid: 'job-uid-2', name: 'testrun-b' } };
      },
      getJob: async () => ({ metadata: { name: 'testrun-b' } }),
    } as never);

    const testRunId = randomUUID();
    const testCase = {
      id: randomUUID(),
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

    await queue.publish({ testRunId, testCase });

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

  test('omits runtimeClassName and nodeSelector when unconfigured (kind)', async ({
    expect,
  }) => {
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

    await queue.publish({
      testRunId: randomUUID(),
      testCase: {
        id: randomUUID(),
        targetSystem: {
          baseUrl: 'https://example.com',
          environment: 'staging',
        },
        authStrategy: { kind: 'NONE' },
        loadProfile: {
          mode: 'CONSTANT',
          config: { duration: 10, targetRate: 1, timeUnit: 'SECONDS' },
        },
        thresholdPolicy: { abortOnFail: false },
        executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 30 },
        steps: [],
      } as never,
    });

    const podSpec = (
      submitted as never as {
        spec: { template: { spec: Record<string, unknown> } };
      }
    ).spec.template.spec;

    expect(podSpec).not.toHaveProperty('runtimeClassName');
    expect(podSpec).not.toHaveProperty('nodeSelector');
  });

  test('applies runtimeClassName and nodeSelector when configured (GKE)', async ({
    expect,
  }) => {
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

    await queue.publish({
      testRunId: randomUUID(),
      testCase: {
        id: randomUUID(),
        targetSystem: {
          baseUrl: 'https://example.com',
          environment: 'staging',
        },
        authStrategy: { kind: 'NONE' },
        loadProfile: {
          mode: 'CONSTANT',
          config: { duration: 10, targetRate: 1, timeUnit: 'SECONDS' },
        },
        thresholdPolicy: { abortOnFail: false },
        executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 30 },
        steps: [],
      } as never,
    });

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
