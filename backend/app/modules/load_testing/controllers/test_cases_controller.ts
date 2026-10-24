import { inject } from '@adonisjs/core';
import type { HttpContext } from '@adonisjs/core/http';
import { actorOf } from '#modules/shared/http/actor';
import type { TestCaseDraft } from '../domain/test_case_definition.js';
import {
  presentTestCase,
  presentTestCaseSummary,
} from '../presenters/load_testing_presenter.js';
import { TestCaseService } from '../services/test_case_service.js';
import { createTestCaseValidator } from '../validators/test_case_validator.js';

@inject()
export default class TestCasesController {
  constructor(private readonly testCases: TestCaseService) {}

  async store(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(createTestCaseValidator);
    const { testCase, run } = await this.testCases.create(
      payload as TestCaseDraft,
      actorOf(ctx),
    );

    ctx.response.status(201);
    return { testCaseId: testCase.id, testRunId: run.id };
  }

  async index(ctx: HttpContext) {
    const testCases = await this.testCases.listOwned(actorOf(ctx));
    return testCases.map(presentTestCaseSummary);
  }

  async show(ctx: HttpContext) {
    const testCase = await this.testCases.findOwned(
      ctx.params.testCaseId,
      actorOf(ctx),
    );
    return presentTestCase(testCase);
  }
}
