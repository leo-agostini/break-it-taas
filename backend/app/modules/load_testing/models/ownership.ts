import type { ActorContext } from '#modules/shared/domain/types';
import { TestCaseOwnerType } from '../domain/test_type.js';

// biome-ignore lint/suspicious/noExplicitAny: Lucid's model and database query builders type their nested where callbacks differently.
type WhereBuilder = { where(callback: (builder: any) => void): unknown };

/**
 * Restricts a query to test cases the actor may see: their own, or their
 * organization's. `testCaseTable` is the table name or alias the query uses
 * for `test_cases`, so the same rule applies to joins from runs and metrics.
 */
export function whereOwnedBy<Query extends WhereBuilder>(
  query: Query,
  actor: ActorContext,
  testCaseTable = 'test_cases',
): Query {
  // biome-ignore lint/suspicious/noExplicitAny: see WhereBuilder.
  query.where((owned: any) => {
    // biome-ignore lint/suspicious/noExplicitAny: see WhereBuilder.
    owned.where((own: any) => {
      own
        .where(`${testCaseTable}.owner_type`, TestCaseOwnerType.USER)
        .where(`${testCaseTable}.owner_id`, actor.userId);
    });

    if (actor.orgId) {
      const orgId = actor.orgId;
      // biome-ignore lint/suspicious/noExplicitAny: see WhereBuilder.
      owned.orWhere((org: any) => {
        org
          .where(`${testCaseTable}.owner_type`, TestCaseOwnerType.ORGANIZATION)
          .where(`${testCaseTable}.owner_id`, orgId);
      });
    }
  });

  return query;
}
