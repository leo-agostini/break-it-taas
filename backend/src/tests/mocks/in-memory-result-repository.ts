import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { ResultRepository } from '@/application/repositories/result-repository';

export class InMemoryResultRepository implements ResultRepository {
  items = new Map<UUID, Record<string, unknown>>();

  async saveForRun(
    testRunId: UUID,
    payload: Record<string, unknown>,
    _tx?: TransactionContext,
  ): Promise<void> {
    this.items.set(testRunId, payload);
  }
}
