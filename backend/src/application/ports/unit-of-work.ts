export type TransactionContext = unknown;

export interface UnitOfWork {
  transaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
