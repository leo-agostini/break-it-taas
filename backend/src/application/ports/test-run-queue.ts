export interface TestRunQueue {
  publish(runId: string): Promise<void>;
  acknowledge(runId: string): Promise<void>;
}
