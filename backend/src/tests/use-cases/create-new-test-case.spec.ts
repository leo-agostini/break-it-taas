import { beforeEach, describe, expect, it } from 'bun:test';
import { CreateNewTestCaseUseCase } from '@/application/use-cases/create-new-test-case';
import { TestCaseOwnerType, TestType } from '@/domain/entities/test-case';
import {
  AuthorizationError,
  LoadProfileCompatibilityError,
  ValidationError,
} from '@/domain/errors/custom-errors';
import { LoadMode, TimeUnit } from '@/domain/vos/load-profile';
import type { RampLoadProfileSetup } from '@/domain/vos/load-profile';
import { makeValidNewTestCaseInput } from '@/tests/fixtures/test-case-fixtures';
import { InMemoryOutboxRepository } from '@/tests/mocks/in-memory-outbox-repository';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';
import { InMemoryTestRunRepository } from '@/tests/mocks/in-memory-test-run-repository';
import { InMemoryUnitOfWork } from '@/tests/mocks/in-memory-unit-of-work';

describe('Create new test case', () => {
  const testCaseRepository = new InMemoryTestCaseRepository();
  const testRunRepository = new InMemoryTestRunRepository();
  const outboxRepository = new InMemoryOutboxRepository();
  const useCase = new CreateNewTestCaseUseCase(
    new InMemoryUnitOfWork(),
    testCaseRepository,
    testRunRepository,
    outboxRepository,
  );

  beforeEach(() => {
    testCaseRepository.items.clear();
    testRunRepository.items.clear();
    outboxRepository.items = [];
  });

  it('creates a test case, initial run, and outbox event', async () => {
    const actorUserId = crypto.randomUUID();
    const result = await useCase.execute(
      makeValidNewTestCaseInput({
        ownerType: TestCaseOwnerType.USER,
        ownerId: actorUserId,
      }) as never,
      {
        userId: actorUserId,
        orgId: null,
      },
    );

    expect(testCaseRepository.items.get(result.testCaseId)).toBeDefined();
    expect(testRunRepository.items.get(result.testRunId)).toBeDefined();
    expect(outboxRepository.items).toHaveLength(1);
    expect(outboxRepository.items[0]?.aggregateId).toBe(result.testRunId);
  });

  it('throws when load profile mode is incompatible with test type', async () => {
    const payload = makeValidNewTestCaseInput({
      loadProfile: {
        mode: LoadMode.RAMP,
        config: {
          initialRate: 5,
          timeUnit: TimeUnit.SECONDS,
          stages: [{ target: 20, duration: 2 }],
        },
      },
    });

    expect(
      useCase.execute(payload as never, {
        userId: payload.ownerId,
        orgId: null,
      }),
    ).rejects.toThrow(LoadProfileCompatibilityError);
  });

  it('throws validation error when environment is blank after trim', async () => {
    const actorUserId = crypto.randomUUID();

    expect(
      useCase.execute(
        makeValidNewTestCaseInput({
          ownerType: TestCaseOwnerType.USER,
          ownerId: actorUserId,
          targetSystem: {
            baseUrl: 'https://api.example.com',
            environment: '   ',
          },
        }) as never,
        {
          userId: actorUserId,
          orgId: null,
        },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws when actor tries to create USER-owned test case for another user', async () => {
    expect(
      useCase.execute(
        makeValidNewTestCaseInput({
          ownerType: TestCaseOwnerType.USER,
          ownerId: crypto.randomUUID(),
        }) as never,
        {
          userId: crypto.randomUUID(),
          orgId: null,
        },
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it('throws when actor tries to create ORGANIZATION-owned test case for another org', async () => {
    expect(
      useCase.execute(
        makeValidNewTestCaseInput({
          ownerType: TestCaseOwnerType.ORGANIZATION,
          ownerId: crypto.randomUUID(),
        }) as never,
        {
          userId: crypto.randomUUID(),
          orgId: crypto.randomUUID(),
        },
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it('derives the load profile from a preset when no explicit profile is given', async () => {
    const actorUserId = crypto.randomUUID();
    const payload = makeValidNewTestCaseInput({
      ownerType: TestCaseOwnerType.USER,
      ownerId: actorUserId,
      testType: TestType.SPIKE,
      loadProfile: undefined,
      loadPreset: { peakRate: 2000, duration: 3, timeUnit: TimeUnit.MINUTES },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 600 },
    });

    const result = await useCase.execute(payload as never, {
      userId: actorUserId,
      orgId: null,
    });

    const created = testCaseRepository.items.get(result.testCaseId);
    expect(created?.loadProfile.mode).toBe(LoadMode.RAMP);
    // A spike ramps up and comes straight back down — no plateau stage.
    expect(
      (created?.loadProfile.config as RampLoadProfileSetup).stages,
    ).toEqual([
      { target: 2000, duration: 2 },
      { target: 0, duration: 1 },
    ]);
  });

  it('rejects a payload that supplies both a preset and an explicit profile', async () => {
    const actorUserId = crypto.randomUUID();
    const payload = makeValidNewTestCaseInput({
      ownerType: TestCaseOwnerType.USER,
      ownerId: actorUserId,
      loadPreset: { peakRate: 10, duration: 5, timeUnit: TimeUnit.SECONDS },
    });

    expect(
      useCase.execute(payload as never, { userId: actorUserId, orgId: null }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a payload that supplies neither a preset nor an explicit profile', async () => {
    const actorUserId = crypto.randomUUID();
    const payload = makeValidNewTestCaseInput({
      ownerType: TestCaseOwnerType.USER,
      ownerId: actorUserId,
      loadProfile: undefined,
    });

    expect(
      useCase.execute(payload as never, { userId: actorUserId, orgId: null }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an execution timeout shorter than the load profile', async () => {
    const actorUserId = crypto.randomUUID();
    const payload = makeValidNewTestCaseInput({
      ownerType: TestCaseOwnerType.USER,
      ownerId: actorUserId,
      testType: TestType.SOAK,
      loadProfile: {
        mode: LoadMode.CONSTANT,
        config: { duration: 8, targetRate: 100, timeUnit: TimeUnit.HOURS },
      },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 30 },
    });

    expect(
      useCase.execute(payload as never, { userId: actorUserId, orgId: null }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a BREAKPOINT test that never aborts', async () => {
    const actorUserId = crypto.randomUUID();
    const payload = makeValidNewTestCaseInput({
      ownerType: TestCaseOwnerType.USER,
      ownerId: actorUserId,
      testType: TestType.BREAKPOINT,
      loadProfile: undefined,
      loadPreset: { peakRate: 20000, duration: 10, timeUnit: TimeUnit.MINUTES },
      thresholdPolicy: { maxP95ResponseTimeMs: 500, abortOnFail: false },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 1200 },
    });

    expect(
      useCase.execute(payload as never, { userId: actorUserId, orgId: null }),
    ).rejects.toThrow(ValidationError);
  });
});
