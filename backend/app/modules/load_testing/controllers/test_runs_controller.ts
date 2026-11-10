import { inject } from '@adonisjs/core';
import type { HttpContext } from '@adonisjs/core/http';
import { actorOf } from '#modules/shared/http/actor';
import type { RunConfigurationOverride } from '../domain/run_configuration.js';
import {
  presentReport,
  presentRunWithMetrics,
  presentTestRun,
} from '../presenters/load_testing_presenter.js';
import { TestRunService } from '../services/test_run_service.js';
import { createTestRunValidator } from '../validators/test_run_validator.js';

@inject()
export default class TestRunsController {
  constructor(private readonly testRuns: TestRunService) {}

  async store(ctx: HttpContext) {
    const override = await ctx.request.validateUsing(createTestRunValidator);
    const run = await this.testRuns.create(
      ctx.params.testCaseId,
      actorOf(ctx),
      override as RunConfigurationOverride,
    );

    ctx.response.status(201);
    return presentTestRun(run);
  }

  async index(ctx: HttpContext) {
    const runs = await this.testRuns.listForTestCase(
      ctx.params.testCaseId,
      actorOf(ctx),
    );
    return runs.map(presentRunWithMetrics);
  }

  async show(ctx: HttpContext) {
    const run = await this.testRuns.findOwned(
      ctx.params.testRunId,
      actorOf(ctx),
    );
    return presentTestRun(run);
  }

  async report(ctx: HttpContext) {
    const report = await this.testRuns.report(
      ctx.params.testRunId,
      actorOf(ctx),
    );
    return presentReport(report);
  }
}
