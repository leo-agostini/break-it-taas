import { describe, expect, it } from 'bun:test';
import { CreateNewTestRunUseCase } from '@/application/use-cases/create-new-test-run';
import { TestRunStatus } from '@/domain/entities/test-run';
import { NotFoundError } from '@/domain/errors/custom-errors';
import { AuthorizationError } from '@/domain/errors/custom-errors';
import { makeTestCase } from '@/tests/fixtures/test-case-fixtures';
import { InMemoryOutboxRepository } from '@/tests/mocks/in-memory-outbox-repository';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';
import { InMemoryTestRunRepository } from '@/tests/mocks/in-memory-test-run-repository';
import { InMemoryUnitOfWork } from '@/tests/mocks/in-memory-unit-of-work';

describe('CreateNewTestRunUseCase', () => {
  it('creates and queues a run and enqueues outbox event', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository();
    const outboxRepository = new InMemoryOutboxRepository();
    const useCase = new CreateNewTestRunUseCase(
      unitOfWork,
      testCaseRepository,
      testRunRepository,
      outboxRepository,
    );

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    const run = await useCase.execute(testCase.id, {
      userId: testCase.ownerId,
      orgId: null,
    });

    expect(run.testCaseId).toBe(testCase.id);
    expect(run.status).toBe(TestRunStatus.QUEUED);
    expect(testRunRepository.items.get(run.id)).toBeDefined();
    expect(outboxRepository.items).toHaveLength(1);
    expect(outboxRepository.items[0]?.aggregateId).toBe(run.id);
  });

  it('throws not found when test case does not exist', async () => {
    const useCase = new CreateNewTestRunUseCase(
      new InMemoryUnitOfWork(),
      new InMemoryTestCaseRepository(),
      new InMemoryTestRunRepository(),
      new InMemoryOutboxRepository(),
    );

    expect(
      useCase.execute(crypto.randomUUID(), {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws authorization error when actor does not own test case', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository();
    const outboxRepository = new InMemoryOutboxRepository();
    const useCase = new CreateNewTestRunUseCase(
      unitOfWork,
      testCaseRepository,
      testRunRepository,
      outboxRepository,
    );

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    expect(
      useCase.execute(testCase.id, {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
