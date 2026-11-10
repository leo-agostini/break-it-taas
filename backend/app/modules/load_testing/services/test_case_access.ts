import {
  AuthorizationError,
  NotFoundError,
} from '#modules/shared/domain/errors';
import type { ActorContext, UUID } from '#modules/shared/domain/types';
import { whereOwnedBy } from '../models/ownership.js';
import TestCase from '../models/test_case.js';

/**
 * Loads a test case the actor is allowed to use. A missing case is a 404 and
 * someone else's case a 403, so the two failures stay distinguishable.
 */
export async function findOwnedTestCase(
  testCaseId: UUID,
  actor: ActorContext,
): Promise<TestCase> {
  const exists = await TestCase.find(testCaseId);
  if (!exists) {
    throw new NotFoundError('Test case not found');
  }

  const owned = await whereOwnedBy(
    TestCase.query().where('id', testCaseId),
    actor,
  ).first();
  if (!owned) {
    throw new AuthorizationError();
  }

  return owned;
}
