import type { Knex } from "knex";
import { db } from "./knex";
import type { TransactionContext, UnitOfWork } from "@/application/ports/unit-of-work";

export class KnexUnitOfWork implements UnitOfWork {
  async transaction<T>(
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (trx: Knex.Transaction) => {
      return work(trx);
    });
  }
}
