import { TestRun } from "@/domain/entities/test-run";
import type { TransactionContext } from "../ports/unit-of-work";

export interface TestRunRepository {
  save(testRun: TestRun, tx?: TransactionContext): Promise<void>;
  find(testRunId: UUID): Promise<TestRun | undefined>;
}
