import { inject } from '@adonisjs/core';
import db from '@adonisjs/lucid/services/db';
import type { TransactionClientContract } from '@adonisjs/lucid/types/database';
import { TestRunEvents } from '#modules/outbox/domain/events';
import { OutboxService } from '#modules/outbox/services/outbox_service';
import { NotFoundError } from '#modules/shared/domain/errors';
import type { ActorContext, UUID } from '#modules/shared/domain/types';
import { whereOwnedBy } from '../models/ownership.js';
import TestRun from '../models/test_run.js';
import TestRunMetric from '../models/test_run_metric.js';
import { findOwnedTestCase } from './test_case_access.js';

@inject()
export class TestRunService {
  constructor(private readonly outbox: OutboxService) {}

  /**
   * Queues a new run and announces it on the outbox, inside the caller's
   * transaction (ADR-001): the worker only ever sees runs that were committed.
   */
  async request(
    testCaseId: UUID,
    trx: TransactionClientContract,
  ): Promise<TestRun> {
    const run = TestRun.draft(testCaseId);
    run.queue();
    run.useTransaction(trx);
    await run.save();

    await this.outbox.enqueue(TestRunEvents.requested(run.id), trx);
    return run;
  }

  async create(testCaseId: UUID, actor: ActorContext): Promise<TestRun> {
    await findOwnedTestCase(testCaseId, actor);
    return db.transaction((trx) => this.request(testCaseId, trx));
  }

  async findOwned(testRunId: UUID, actor: ActorContext): Promise<TestRun> {
    const run = await whereOwnedBy(
      TestRun.query()
        .join('test_cases', 'test_cases.id', 'test_runs.test_case_id')
        .where('test_runs.id', testRunId)
        .select('test_runs.*'),
      actor,
    ).first();

    if (!run) {
      throw new NotFoundError('Test run not found');
    }
    return run;
  }

  async listForTestCase(
    testCaseId: UUID,
    actor: ActorContext,
  ): Promise<Array<{ run: TestRun; metrics: TestRunMetric | null }>> {
    await findOwnedTestCase(testCaseId, actor);

    const runs = await TestRun.query()
      .where('test_case_id', testCaseId)
      .orderBy('created_at', 'desc');

    const metrics =
      runs.length === 0
        ? []
        : await TestRunMetric.query().whereIn(
            'test_run_id',
            runs.map((run) => run.id),
          );
    const metricsByRunId = new Map(
      metrics.map((metric) => [metric.testRunId, metric]),
    );

    return runs.map((run) => ({
      run,
      metrics: metricsByRunId.get(run.id) ?? null,
    }));
  }

  /**
   * The metrics of a finished run, plus the artifacts the runner reported.
   * Only runs with a stored result have a report.
   */
  async report(
    testRunId: UUID,
    actor: ActorContext,
  ): Promise<{ metrics: TestRunMetric; artifacts: string[] }> {
    const metrics = await whereOwnedBy(
      TestRunMetric.query()
        .join('test_runs as tr', 'tr.id', 'test_run_metrics.test_run_id')
        .join('test_cases as tc', 'tc.id', 'tr.test_case_id')
        .join('results as r', 'r.test_run_id', 'tr.id')
        .where('test_run_metrics.test_run_id', testRunId)
        .select(
          'test_run_metrics.*',
          db.raw(
            "COALESCE((r.payload->'artifacts')::jsonb, '[]'::jsonb) as artifacts",
          ),
        ),
      actor,
      'tc',
    ).first();

    if (!metrics) {
      throw new NotFoundError('Test run report not found');
    }

    const artifacts = metrics.$extras.artifacts;
    return {
      metrics,
      artifacts: Array.isArray(artifacts) ? artifacts : [],
    };
  }
}
