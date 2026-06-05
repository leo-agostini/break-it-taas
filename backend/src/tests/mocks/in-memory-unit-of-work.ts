import type {
  TransactionContext,
  UnitOfWork,
} from '@/application/ports/unit-of-work';

export class InMemoryUnitOfWork implements UnitOfWork {
  async transaction<T>(
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return work({});
  }
}
