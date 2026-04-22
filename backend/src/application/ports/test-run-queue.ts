import { TestRun } from "@/domain/entities/test-run";

export interface TestRunQueue {
  publish(run: TestRun): Promise<void>;
  acknowledge(runId: string): Promise<void>;
}
