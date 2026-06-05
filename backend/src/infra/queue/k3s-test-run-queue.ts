import type { V1Job } from '@kubernetes/client-node';
import { createHmac } from 'node:crypto';
import type { TestRunQueue } from '@/application/ports/test-run-queue';
import type { TestCase } from '@/domain/entities/test-case';
import { ResourceProfile } from '@/domain/vos/execution-policy';
import type { TestRun } from '@/domain/entities/test-run';
import { env } from '@/infra/config/env';
import { KubernetesJobClient } from '@/infra/k8s/kubernetes-job-client';

export class K3sTestRunQueue implements TestRunQueue {
  constructor(private readonly jobClient = new KubernetesJobClient()) {}

  private buildJobName(runId: string): string {
    return `testrun-${runId.slice(0, 18).replace(/[^a-zA-Z0-9-]/g, '')}`.toLowerCase();
  }

  private buildRunnerConfig(run: TestRun, testCase: TestCase) {
    return {
      testRunId: run.id,
      testCaseId: testCase.id,
      targetSystem: testCase.targetSystem,
      authStrategy: testCase.authStrategy,
      loadProfile: testCase.loadProfile,
      thresholdPolicy: testCase.thresholdPolicy,
      executionPolicy: testCase.executionPolicy,
      steps: testCase.steps,
    };
  }

  private signConfig(configJson: string): string {
    return createHmac('sha256', env.RUNNER_SHARED_SECRET)
      .update(configJson)
      .digest('hex');
  }

  private resolveResources(testCase: TestCase): {
    cpu: string;
    memory: string;
  } {
    if (
      testCase.executionPolicy.resourceProfile === ResourceProfile.CUSTOM &&
      testCase.executionPolicy.cpuMillicores &&
      testCase.executionPolicy.memoryMb
    ) {
      return {
        cpu: `${testCase.executionPolicy.cpuMillicores}m`,
        memory: `${testCase.executionPolicy.memoryMb}Mi`,
      };
    }

    switch (testCase.executionPolicy.resourceProfile) {
      case ResourceProfile.SMALL:
        return { cpu: '250m', memory: '256Mi' };
      case ResourceProfile.MEDIUM:
        return { cpu: '500m', memory: '512Mi' };
      case ResourceProfile.LARGE:
        return { cpu: '1000m', memory: '1024Mi' };
      default:
        return { cpu: '250m', memory: '256Mi' };
    }
  }

  private buildJobManifest(run: TestRun, testCase: TestCase, jobName: string): V1Job {
    const runConfig = this.buildRunnerConfig(run, testCase);
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
          'breakit/test-run-id': run.id,
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
              'breakit/test-run-id': run.id,
            },
          },
          spec: {
            restartPolicy: 'Never',
            containers: [
              {
                name: 'runner',
                image: env.RUNNER_IMAGE,
                imagePullPolicy: 'IfNotPresent',
                command: ['/bin/sh', '/k6-runner/run.sh'],
                env: [
                  { name: 'TEST_RUN_ID', value: run.id },
                  {
                    name: 'CALLBACK_URL',
                    value: `${env.RUNNER_CALLBACK_BASE_URL}/api/internal/test-runs/callback`,
                  },
                  {
                    name: 'RUNNER_SHARED_SECRET',
                    value: env.RUNNER_SHARED_SECRET,
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

  async publish(
    run: TestRun,
    testCase: TestCase,
  ): Promise<{ runtimeRef: string }> {
    const namespace = env.K3S_NAMESPACE;
    const jobName = this.buildJobName(run.id);
    const job = this.buildJobManifest(run, testCase, jobName);

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
      throw new Error(`K3s job creation failed: ${message}`);
    }
  }

  async acknowledge(_runId: string): Promise<void> {
    return Promise.resolve();
  }
}
