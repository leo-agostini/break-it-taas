import { describe, expect, it } from 'bun:test';
import { GetTestRunUseCase } from '@/application/use-cases/get-test-run';
import { TestRun, TestRunStatus } from '@/domain/entities/test-run';
import { NotFoundError } from '@/domain/errors/custom-errors';
import { makeTestCase } from '@/tests/fixtures/test-case-fixtures';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';
import { InMemoryTestRunRepository } from '@/tests/mocks/in-memory-test-run-repository';

describe('GetTestRunUseCase', () => {
  it('returns a run owned by the actor even before it completes', async () => {
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository(testCaseRepository);
    const useCase = new GetTestRunUseCase(testRunRepository);

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    const run = TestRun.create({ testCaseId: testCase.id });
    run.queue();
    await testRunRepository.save(run);

    const result = await useCase.execute(run.id as UUID, {
      userId: testCase.ownerId,
      orgId: null,
    });

    expect(result.id).toBe(run.id);
    expect(result.status).toBe(TestRunStatus.QUEUED);
  });

  it('throws not found when the run does not exist', async () => {
    const useCase = new GetTestRunUseCase(
      new InMemoryTestRunRepository(new InMemoryTestCaseRepository()),
    );

    expect(
      useCase.execute(crypto.randomUUID(), {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws not found when the actor does not own the run', async () => {
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository(testCaseRepository);
    const useCase = new GetTestRunUseCase(testRunRepository);

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);
    const run = TestRun.create({ testCaseId: testCase.id });
    await testRunRepository.save(run);

    expect(
      useCase.execute(run.id as UUID, {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
