import type { TransactionContext } from '@/application/ports/unit-of-work';
import type {
  TestRunMetricsProjection,
  TestRunMetricsReport,
  TestRunMetricsRepository,
} from '@/application/repositories/test-run-metrics-repository';

export class InMemoryTestRunMetricsRepository
  implements TestRunMetricsRepository
{
  items = new Map<UUID, TestRunMetricsReport>();

  async upsert(
    projection: TestRunMetricsProjection,
    _tx?: TransactionContext,
  ): Promise<void> {
    this.items.set(projection.testRunId, {
      ...projection,
      artifacts: [],
    });
  }

  async findOwnedReport(args: {
    testRunId: UUID;
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestRunMetricsReport | null> {
    void args.actorUserId;
    void args.actorOrgId;
    return this.items.get(args.testRunId) ?? null;
  }
}
