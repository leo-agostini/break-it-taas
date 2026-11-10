import { test } from '@japa/runner';
import {
  type TestCaseDraft,
  assertActorMayOwn,
  buildTestCaseDefinition,
} from '#modules/load_testing/domain/test_case_definition';
import {
  TestCaseOwnerType,
  TestType,
} from '#modules/load_testing/domain/test_type';
import {
  LoadMode,
  type RampLoadProfileSetup,
  TimeUnit,
} from '#modules/load_testing/domain/vos/load_profile';
import {
  AuthorizationError,
  LoadProfileCompatibilityError,
  ValidationError,
} from '#modules/shared/domain/errors';
import { makeValidNewTestCaseInput } from '#tests/fixtures/test_case_fixtures';

const draft = (overrides?: Partial<Record<string, unknown>>) =>
  makeValidNewTestCaseInput(overrides) as unknown as TestCaseDraft;

test.group('buildTestCaseDefinition', () => {
  test('keeps an explicit load profile as authored', ({ expect }) => {
    const definition = buildTestCaseDefinition(draft());

    expect(definition.loadProfile.mode).toBe(LoadMode.CONSTANT);
    expect(definition.loadProfile.config).toEqual({
      duration: 5,
      targetRate: 10,
      timeUnit: TimeUnit.SECONDS,
    });
    expect(definition.steps).toHaveLength(1);
  });

  test('derives the profile from a preset', ({ expect }) => {
    const definition = buildTestCaseDefinition(
      draft({
        testType: TestType.AVG_LOAD,
        loadProfile: undefined,
        loadPreset: { peakRate: 50, duration: 10, timeUnit: TimeUnit.MINUTES },
        executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 900 },
      }),
    );

    expect(definition.loadProfile.mode).toBe(LoadMode.RAMP);
    const config = definition.loadProfile.config as RampLoadProfileSetup;
    expect(config.stages.map((stage) => stage.duration)).toEqual([1, 8, 1]);
  });

  test('rejects a draft with both a profile and a preset', ({ expect }) => {
    expect(() =>
      buildTestCaseDefinition(
        draft({
          loadPreset: { peakRate: 5, duration: 5, timeUnit: TimeUnit.SECONDS },
        }),
      ),
    ).toThrow(ValidationError);
  });

  test('rejects a draft with neither a profile nor a preset', ({ expect }) => {
    expect(() =>
      buildTestCaseDefinition(draft({ loadProfile: undefined })),
    ).toThrow(ValidationError);
  });

  test('rejects a load mode incompatible with the test type', ({ expect }) => {
    expect(() =>
      buildTestCaseDefinition(
        draft({
          loadProfile: {
            mode: LoadMode.RAMP,
            config: {
              initialRate: 5,
              timeUnit: TimeUnit.SECONDS,
              stages: [{ target: 20, duration: 2 }],
            },
          },
        }),
      ),
    ).toThrow(LoadProfileCompatibilityError);
  });

  test('rejects a blank environment', ({ expect }) => {
    expect(() =>
      buildTestCaseDefinition(
        draft({
          targetSystem: {
            baseUrl: 'https://api.example.com',
            environment: ' ',
          },
        }),
      ),
    ).toThrow(ValidationError);
  });
});

test.group('assertActorMayOwn', () => {
  const actor = { userId: 'user-1', orgId: 'org-1' };

  test('allows the caller or their organization', ({ expect }) => {
    expect(() =>
      assertActorMayOwn(
        { ownerType: TestCaseOwnerType.USER, ownerId: 'user-1' },
        actor,
      ),
    ).not.toThrow();
    expect(() =>
      assertActorMayOwn(
        { ownerType: TestCaseOwnerType.ORGANIZATION, ownerId: 'org-1' },
        actor,
      ),
    ).not.toThrow();
  });

  test('rejects anyone else', ({ expect }) => {
    expect(() =>
      assertActorMayOwn(
        { ownerType: TestCaseOwnerType.USER, ownerId: 'user-2' },
        actor,
      ),
    ).toThrow(AuthorizationError);
    expect(() =>
      assertActorMayOwn(
        { ownerType: TestCaseOwnerType.ORGANIZATION, ownerId: 'org-1' },
        { userId: 'user-1', orgId: null },
      ),
    ).toThrow(AuthorizationError);
  });
});
