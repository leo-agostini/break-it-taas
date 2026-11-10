import vine from '@vinejs/vine';
import { TestCaseOwnerType, TestType } from '../domain/test_type.js';
import { AuthStrategyKind } from '../domain/vos/auth_strategy.js';
import { CheckKind, HttpMethod } from '../domain/vos/step.js';
import { discriminator, integer, ratio, unknownVariant } from './helpers.js';
import {
  executionPolicySchema,
  loadPresetSchema,
  loadProfileSchema,
} from './run_configuration_schemas.js';

/*
| Structural validation of a test case payload: types, ranges, and which
| fields each variant carries. Rules that span several fields (preset vs.
| explicit profile, test type ↔ load mode, BREAKPOINT thresholds, timeout vs.
| profile length) belong to the domain: see buildTestCaseDefinition.
*/

const stepCheck = vine
  .union([
    vine.union.if(
      discriminator('kind', CheckKind.STATUS_CODE),
      vine.object({
        kind: vine.literal(CheckKind.STATUS_CODE),
        expected: integer(),
      }),
    ),
    vine.union.if(
      discriminator('kind', CheckKind.RESPONSE_TIME_LT),
      vine.object({
        kind: vine.literal(CheckKind.RESPONSE_TIME_LT),
        maxMs: integer().min(0),
      }),
    ),
    vine.union.if(
      discriminator('kind', CheckKind.BODY_CONTAINS),
      vine.object({
        kind: vine.literal(CheckKind.BODY_CONTAINS),
        value: vine.string(),
      }),
    ),
    vine.union.if(
      discriminator('kind', CheckKind.JSON_PATH_EQUALS),
      vine.object({
        kind: vine.literal(CheckKind.JSON_PATH_EQUALS),
        path: vine.string().minLength(1),
        expected: vine.unionOfTypes([
          vine.string(),
          vine.number({ strict: true }),
          vine.boolean({ strict: true }),
        ]),
      }),
    ),
  ])
  .otherwise(unknownVariant('kind'));

const step = vine.object({
  path: vine.string().minLength(1),
  method: vine.enum(Object.values(HttpMethod)),
  checks: vine.array(stepCheck).optional(),
  body: vine.record(vine.any()).optional(),
  headers: vine.record(vine.string()).optional(),
});

const secretRef = vine.object({
  provider: vine.string().minLength(1),
  key: vine.string().minLength(1),
});

const nameValuePairs = () =>
  vine
    .array(
      vine.object({ name: vine.string().minLength(1), value: vine.string() }),
    )
    .optional();

const authHttpRequest = vine.object({
  method: vine.enum([
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
  ] as const),
  path: vine.string().minLength(1),
  headers: nameValuePairs(),
  queryParams: nameValuePairs(),
  body: vine.record(vine.any()).optional(),
  timeoutMs: integer().min(1).optional(),
});

const authStrategy = vine
  .union([
    vine.union.if(
      discriminator('kind', AuthStrategyKind.NONE),
      vine.object({ kind: vine.literal(AuthStrategyKind.NONE) }),
    ),
    vine.union.if(
      discriminator('kind', AuthStrategyKind.BEARER_TOKEN),
      vine.object({
        kind: vine.literal(AuthStrategyKind.BEARER_TOKEN),
        tokenRef: secretRef,
      }),
    ),
    vine.union.if(
      discriminator('kind', AuthStrategyKind.BASIC_AUTH),
      vine.object({
        kind: vine.literal(AuthStrategyKind.BASIC_AUTH),
        username: vine.string().minLength(1),
        passwordRef: secretRef,
      }),
    ),
    vine.union.if(
      discriminator('kind', AuthStrategyKind.API_KEY_HEADER),
      vine.object({
        kind: vine.literal(AuthStrategyKind.API_KEY_HEADER),
        headerName: vine.string().minLength(1),
        valueRef: secretRef,
      }),
    ),
    vine.union.if(
      discriminator('kind', AuthStrategyKind.LOGIN_FLOW),
      vine.object({
        kind: vine.literal(AuthStrategyKind.LOGIN_FLOW),
        loginRequest: authHttpRequest,
        tokenExtraction: vine.object({
          kind: vine.literal('JSON_PATH'),
          path: vine.string().minLength(1),
        }),
        applyAs: vine.enum(['BEARER_TOKEN', 'HEADER'] as const),
      }),
    ),
  ])
  .otherwise(unknownVariant('kind'));

export const createTestCaseValidator = vine.create({
  name: vine.string().minLength(1),
  description: vine.string().minLength(1).optional(),
  ownerType: vine.enum(Object.values(TestCaseOwnerType)),
  ownerId: vine.string().uuid(),
  testType: vine.enum(Object.values(TestType)),
  targetSystem: vine.object({
    // Load targets are often bare hosts or IPs (e.g. the kind gateway), so a
    // top-level domain is not required.
    baseUrl: vine.string().url({ require_tld: false }),
    environment: vine.string().minLength(1),
  }),
  authStrategy,
  // The default load of the case's runs: either authored by hand, or derived
  // from the test type.
  loadProfile: loadProfileSchema.optional(),
  loadPreset: loadPresetSchema.optional(),
  thresholdPolicy: vine.object({
    maxErrorRate: ratio().optional(),
    maxP95ResponseTimeMs: integer().min(1).optional(),
    maxP99ResponseTimeMs: integer().min(1).optional(),
    minCheckSuccessRate: ratio().optional(),
    abortOnFail: vine.boolean({ strict: true }).optional(),
  }),
  executionPolicy: executionPolicySchema,
  steps: vine.array(step).optional(),
});
