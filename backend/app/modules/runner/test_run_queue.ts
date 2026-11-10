/**
 * What a runner needs to execute one test run. Deliberately structural and
 * JSON-shaped: the runner module translates it into a Kubernetes Job and never
 * imports the load-testing domain, so the dependency only points one way.
 */
export interface RunnerJob {
  testRunId: string;
  testCase: {
    id: string;
    testType: string;
    targetSystem: unknown;
    authStrategy: unknown;
    loadProfile: unknown;
    thresholdPolicy: unknown;
    executionPolicy: {
      resourceProfile: string;
      timeoutSeconds: number;
      cpuMillicores?: number;
      memoryMb?: number;
    };
    steps: unknown;
  };
}

/**
 * Port for "start executing this run somewhere". Bound to the Kubernetes
 * implementation in providers/app_provider.ts; tests swap it for a fake.
 */
export abstract class TestRunQueue {
  abstract publish(job: RunnerJob): Promise<{ runtimeRef: string }>;
}
