import type { TestCase } from '@/domain/entities/test-case';
import type { TestRun } from '@/domain/entities/test-run';

export interface TestRunQueue {
  publish(run: TestRun, testCase: TestCase): Promise<{ runtimeRef: string }>;
  acknowledge(runId: string): Promise<void>;
}
