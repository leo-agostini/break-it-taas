import type { TransactionContext } from '@/application/ports/unit-of-work';

export interface ResultRepository {
  saveForRun(
    testRunId: UUID,
    payload: Record<string, unknown>,
    tx?: TransactionContext,
  ): Promise<void>;
}
