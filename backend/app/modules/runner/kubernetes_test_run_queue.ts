import { createHmac } from 'node:crypto';
import type { V1Job } from '@kubernetes/client-node';
import env from '#start/env';
import { KubernetesJobClient } from './kubernetes_job_client.js';
import {
  type RunnerScheduling,
  resolveRunnerScheduling,
} from './runner_scheduling.js';
import { type RunnerJob, TestRunQueue } from './test_run_queue.js';

type RunnerTestCase = RunnerJob['testCase'];

export class KubernetesTestRunQueue extends TestRunQueue {
  constructor(
    private readonly jobClient = new KubernetesJobClient(),
    private readonly scheduling: RunnerScheduling = resolveRunnerScheduling(
      env.get('RUNNER_RUNTIME_CLASS'),
      env.get('RUNNER_NODE_SELECTOR'),
    ),
  ) {
    super();
  }

  private buildJobName(runId: string): string {
    return `testrun-${runId.slice(0, 18).replace(/[^a-zA-Z0-9-]/g, '')}`.toLowerCase();
  }

  private buildRunnerConfig(testRunId: string, testCase: RunnerTestCase) {
    return {
      testRunId,
      testCaseId: testCase.id,
      // The runner applies per-type behavior (notably the BREAKPOINT abort),
      // so the type travels inside the HMAC-signed config rather than as a
      // separate, unsigned env var.
      testType: testCase.testType,
      targetSystem: testCase.targetSystem,
      authStrategy: testCase.authStrategy,
      loadProfile: testCase.loadProfile,
      thresholdPolicy: testCase.thresholdPolicy,
      executionPolicy: testCase.executionPolicy,
      steps: testCase.steps,
    };
  }

  private signConfig(configJson: string): string {
    return createHmac('sha256', env.get('RUNNER_SHARED_SECRET').release())
      .update(configJson)
      .digest('hex');
  }

  private resolveResources(testCase: RunnerTestCase): {
    cpu: string;
    memory: string;
  } {
    if (
      testCase.executionPolicy.resourceProfile === 'CUSTOM' &&
      testCase.executionPolicy.cpuMillicores &&
      testCase.executionPolicy.memoryMb
    ) {
      return {
        cpu: `${testCase.executionPolicy.cpuMillicores}m`,
        memory: `${testCase.executionPolicy.memoryMb}Mi`,
      };
    }

    switch (testCase.executionPolicy.resourceProfile) {
      case 'SMALL':
        return { cpu: '250m', memory: '256Mi' };
      case 'MEDIUM':
        return { cpu: '500m', memory: '512Mi' };
      case 'LARGE':
        return { cpu: '1000m', memory: '1024Mi' };
      default:
        return { cpu: '250m', memory: '256Mi' };
    }
  }

  private buildJobManifest(
    testRunId: string,
    testCase: RunnerTestCase,
    jobName: string,
  ): V1Job {
    const runConfig = this.buildRunnerConfig(testRunId, testCase);
    const runConfigJson = JSON.stringify(runConfig);
    const runConfigHmac = this.signConfig(runConfigJson);
    const resources = this.resolveResources(testCase);

    return {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: jobName,
        labels: {
          'app.kubernetes.io/name': 'test-runner',
          'breakit/test-run-id': testRunId,
        },
      },
      spec: {
        backoffLimit: 0,
        activeDeadlineSeconds: testCase.executionPolicy.timeoutSeconds,
        ttlSecondsAfterFinished: 600,
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'test-runner',
              'breakit/test-run-id': testRunId,
            },
          },
          spec: {
            restartPolicy: 'Never',
            // Spread only when configured. kind leaves both unset; managed
            // clusters supply them through RUNNER_RUNTIME_CLASS and
            // RUNNER_NODE_SELECTOR so the same template schedules on both.
            ...(this.scheduling.runtimeClassName
              ? { runtimeClassName: this.scheduling.runtimeClassName }
              : {}),
            ...(this.scheduling.nodeSelector
              ? { nodeSelector: this.scheduling.nodeSelector }
              : {}),
            containers: [
              {
                name: 'runner',
                image: env.get('RUNNER_IMAGE', 'breakit-k6-runner:local'),
                imagePullPolicy: 'IfNotPresent',
                command: ['/bin/sh', '/k6-runner/run.sh'],
                env: [
                  { name: 'TEST_RUN_ID', value: testRunId },
                  {
                    name: 'CALLBACK_URL',
                    value: `${env.get('RUNNER_CALLBACK_BASE_URL')}/api/internal/test-runs/callback`,
                  },
                  {
                    name: 'RUNNER_SHARED_SECRET',
                    value: env.get('RUNNER_SHARED_SECRET').release(),
                  },
                  {
                    name: 'RUN_CONFIG_JSON',
                    value: runConfigJson,
                  },
                  {
                    name: 'RUN_CONFIG_HMAC',
                    value: runConfigHmac,
                  },
                  { name: 'RUNTIME_REF', value: jobName },
                ],
                resources: {
                  requests: {
                    cpu: resources.cpu,
                    memory: resources.memory,
                  },
                  limits: {
                    cpu: resources.cpu,
                    memory: resources.memory,
                  },
                },
              },
            ],
          },
        },
      },
    };
  }

  async publish({
    testRunId,
    testCase,
  }: RunnerJob): Promise<{ runtimeRef: string }> {
    const namespace = env.get('KUBERNETES_NAMESPACE', 'app');
    const jobName = this.buildJobName(testRunId);
    const job = this.buildJobManifest(testRunId, testCase, jobName);

    try {
      const created = await this.jobClient.createJob(namespace, job);
      const runtimeRef =
        created.metadata?.uid ?? created.metadata?.name ?? jobName;
      return { runtimeRef };
    } catch (error) {
      if (KubernetesJobClient.isAlreadyExists(error)) {
        const existing = await this.jobClient.getJob(namespace, jobName);
        const runtimeRef =
          existing.metadata?.uid ?? existing.metadata?.name ?? jobName;
        return { runtimeRef };
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Kubernetes job creation failed: ${message}`);
    }
  }
}
