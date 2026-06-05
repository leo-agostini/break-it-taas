import type { TestRun } from '@/domain/entities/test-run';
import type { TestCase } from '@/domain/entities/test-case';

export interface TestRunQueue {
  publish(run: TestRun, testCase: TestCase): Promise<{ runtimeRef: string }>;
  acknowledge(runId: string): Promise<void>;
}
