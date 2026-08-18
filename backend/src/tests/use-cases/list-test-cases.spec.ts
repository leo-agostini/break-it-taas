import { describe, expect, it } from 'bun:test';
import { ListTestCasesUseCase } from '@/application/use-cases/list-test-cases';
import { TestCaseOwnerType } from '@/domain/entities/test-case';
import { TestRun } from '@/domain/entities/test-run';
import { makeTestCase } from '@/tests/fixtures/test-case-fixtures';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';
import { InMemoryTestRunRepository } from '@/tests/mocks/in-memory-test-run-repository';

function makeUseCase() {
  const testCaseRepository = new InMemoryTestCaseRepository();
  const testRunRepository = new InMemoryTestRunRepository(testCaseRepository);
  const useCase = new ListTestCasesUseCase(
    testCaseRepository,
    testRunRepository,
  );

  return { useCase, testCaseRepository, testRunRepository };
}

describe('ListTestCasesUseCase', () => {
  it('returns an empty list when the actor owns nothing', async () => {
    const { useCase } = makeUseCase();

    const result = await useCase.execute({
      userId: crypto.randomUUID(),
      orgId: null,
    });

    expect(result).toEqual([]);
  });

  it('returns only test cases owned by the actor', async () => {
    const { useCase, testCaseRepository } = makeUseCase();
    const ownerId = crypto.randomUUID();

    const owned = makeTestCase({ ownerId });
    const foreign = makeTestCase({ ownerId: crypto.randomUUID() });
    await testCaseRepository.create(owned);
    await testCaseRepository.create(foreign);

    const result = await useCase.execute({ userId: ownerId, orgId: null });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(owned.id);
  });

  it('includes the run count for each test case', async () => {
    const { useCase, testCaseRepository, testRunRepository } = makeUseCase();
    const ownerId = crypto.randomUUID();

    const withRuns = makeTestCase({ ownerId });
    const withoutRuns = makeTestCase({ ownerId });
    await testCaseRepository.create(withRuns);
    await testCaseRepository.create(withoutRuns);

    await testRunRepository.save(TestRun.create({ testCaseId: withRuns.id }));
    await testRunRepository.save(TestRun.create({ testCaseId: withRuns.id }));

    const result = await useCase.execute({ userId: ownerId, orgId: null });
    const byId = new Map(result.map((item) => [item.id, item.runCount]));

    expect(byId.get(withRuns.id)).toBe(2);
    expect(byId.get(withoutRuns.id)).toBe(0);
  });

  it('returns organization-owned test cases for a member actor', async () => {
    const { useCase, testCaseRepository } = makeUseCase();
    const orgId = crypto.randomUUID();

    const orgTestCase = makeTestCase({
      ownerType: TestCaseOwnerType.ORGANIZATION,
      ownerId: orgId,
    });
    await testCaseRepository.create(orgTestCase);

    const result = await useCase.execute({
      userId: crypto.randomUUID(),
      orgId,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(orgTestCase.id);
  });
});
