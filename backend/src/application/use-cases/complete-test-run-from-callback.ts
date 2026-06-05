import type { UnitOfWork } from '@/application/ports/unit-of-work';
import { normalizeK6ResultMetrics } from '@/application/projections/normalize-k6-result-metrics';
import type { ResultRepository } from '@/application/repositories/result-repository';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestRunMetricsRepository } from '@/application/repositories/test-run-metrics-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import { TestRunStatus } from '@/domain/entities/test-run';
import {
  InvariantViolationError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors/custom-errors';
import { z } from 'zod';

const callbackSchema = z.object({
  testRunId: z.string().uuid(),
  status: z.enum([
    TestRunStatus.SUCCEEDED,
    TestRunStatus.FAILED,
    TestRunStatus.TIMEOUT,
    TestRunStatus.CANCELLED,
  ]),
  resultSummary: z.record(z.string(), z.unknown()),
  artifacts: z.array(z.string()).default([]),
  runtimeRef: z.string().min(1),
  completedAt: z.string().datetime().optional(),
});

type CallbackPayload = z.infer<typeof callbackSchema>;

const isTerminalStatus = (status: TestRunStatus) => {
  return [
    TestRunStatus.SUCCEEDED,
    TestRunStatus.FAILED,
    TestRunStatus.TIMEOUT,
    TestRunStatus.CANCELLED,
  ].includes(status);
};

export class CompleteTestRunFromCallbackUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly testRunRepository: TestRunRepository,
    private readonly resultRepository: ResultRepository,
    private readonly testCaseRepository: TestCaseRepository,
    private readonly testRunMetricsRepository: TestRunMetricsRepository,
  ) {}

  async execute(input: unknown): Promise<{ updated: boolean }> {
    const parsed = callbackSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid runner callback payload');
    }

    const payload = parsed.data;

    return this.unitOfWork.transaction(async (tx) => {
      const run = await this.testRunRepository.find(payload.testRunId);
      if (!run) {
        throw new NotFoundError(`Test run ${payload.testRunId} not found`);
      }

      if (isTerminalStatus(run.status)) {
        return { updated: false };
      }

      if (run.status === TestRunStatus.QUEUED) {
        run.start();
      }

      if (run.status !== TestRunStatus.RUNNING) {
        throw new InvariantViolationError(
          `Cannot complete run in status ${run.status}`,
        );
      }

      run.runtimeRef = payload.runtimeRef;
      run.resultSummary = payload.resultSummary;
      run.artifacts = payload.artifacts;

      switch (payload.status) {
        case TestRunStatus.SUCCEEDED:
          run.succeeded();
          break;
        case TestRunStatus.FAILED:
          run.failed();
          break;
        case TestRunStatus.TIMEOUT:
          run.timeout();
          break;
        case TestRunStatus.CANCELLED:
          run.cancel();
          break;
      }

      if (payload.completedAt) {
        run.completedAt = new Date(payload.completedAt);
      }

      await this.testRunRepository.save(run, tx);
      await this.resultRepository.saveForRun(
        run.id,
        this.resultPayload(run, payload),
        tx,
      );
      const testCase = await this.testCaseRepository.find(run.testCaseId);
      if (testCase) {
        const projection = normalizeK6ResultMetrics({
          testRunId: run.id,
          status: payload.status,
          runtimeRef: payload.runtimeRef,
          completedAt: payload.completedAt,
          artifacts: payload.artifacts,
          resultSummary: payload.resultSummary,
          testCase,
        });
        await this.testRunMetricsRepository.upsert(projection, tx);
      }

      return { updated: true };
    });
  }

  private resultPayload(run: { id: string }, payload: CallbackPayload) {
    return {
      testRunId: run.id,
      status: payload.status,
      runtimeRef: payload.runtimeRef,
      completedAt: payload.completedAt ?? new Date().toISOString(),
      resultSummary: payload.resultSummary,
      artifacts: payload.artifacts,
    } satisfies Record<string, unknown>;
  }
}
