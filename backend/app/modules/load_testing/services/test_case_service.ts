import { inject } from '@adonisjs/core';
import db from '@adonisjs/lucid/services/db';
import type { ActorContext, UUID } from '#modules/shared/domain/types';
import {
  type TestCaseDraft,
  assertActorMayOwn,
  buildTestCaseDefinition,
} from '../domain/test_case_definition.js';
import { whereOwnedBy } from '../models/ownership.js';
import TestCase from '../models/test_case.js';
import type TestRun from '../models/test_run.js';
import { findOwnedTestCase } from './test_case_access.js';
import { TestRunService } from './test_run_service.js';

@inject()
export class TestCaseService {
  constructor(private readonly runs: TestRunService) {}

  /**
   * Creating a test case also queues its first run, at the case's default
   * configuration, atomically: either both exist (plus the outbox event that
   * dispatches the run) or neither does.
   */
  async create(
    draft: TestCaseDraft,
    actor: ActorContext,
  ): Promise<{ testCase: TestCase; run: TestRun }> {
    assertActorMayOwn(draft, actor);
    const definition = buildTestCaseDefinition(draft);

    return db.transaction(async (trx) => {
      const testCase = TestCase.fromDefinition(definition);
      testCase.useTransaction(trx);
      await testCase.save();

      const run = await this.runs.request(testCase.id, definition, trx);
      return { testCase, run };
    });
  }

  async findOwned(testCaseId: UUID, actor: ActorContext): Promise<TestCase> {
    return findOwnedTestCase(testCaseId, actor);
  }

  /** Newest first, each with `$extras.runs_count`. */
  async listOwned(actor: ActorContext): Promise<TestCase[]> {
    return whereOwnedBy(TestCase.query(), actor)
      .withCount('runs')
      .orderBy('created_at', 'desc');
  }
}
