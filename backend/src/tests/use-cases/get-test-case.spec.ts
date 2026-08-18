import { describe, expect, it } from 'bun:test';
import { GetTestCaseUseCase } from '@/application/use-cases/get-test-case';
import {
  AuthorizationError,
  NotFoundError,
} from '@/domain/errors/custom-errors';
import { makeTestCase } from '@/tests/fixtures/test-case-fixtures';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';

describe('GetTestCaseUseCase', () => {
  it('returns the test case owned by the actor', async () => {
    const testCaseRepository = new InMemoryTestCaseRepository();
    const useCase = new GetTestCaseUseCase(testCaseRepository);

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    const result = await useCase.execute(testCase.id as UUID, {
      userId: testCase.ownerId,
      orgId: null,
    });

    expect(result.id).toBe(testCase.id);
  });

  it('throws not found when the test case does not exist', async () => {
    const useCase = new GetTestCaseUseCase(new InMemoryTestCaseRepository());

    expect(
      useCase.execute(crypto.randomUUID(), {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws authorization error when the actor does not own it', async () => {
    const testCaseRepository = new InMemoryTestCaseRepository();
    const useCase = new GetTestCaseUseCase(testCaseRepository);

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    expect(
      useCase.execute(testCase.id as UUID, {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
