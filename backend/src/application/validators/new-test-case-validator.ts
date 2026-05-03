import { TestCaseOwnerType, TestType } from "@/domain/entities/test-case";
import { AuthStrategyKind } from "@/domain/vos/auth-strategy";
import { ResourceProfile } from "@/domain/vos/execution-policy";
import { LoadMode, TimeUnit } from "@/domain/vos/load-profile";
import { CheckKind, HttpMethod } from "@/domain/vos/step";
import { z } from "zod";

const stageSchema = z.object({
  target: z.number().int().min(0),
  duration: z.number().int().min(1),
});

const constantLoadProfileSchema = z.object({
  mode: z.literal(LoadMode.CONSTANT),
  config: z.object({
    duration: z.number().int().min(1),
    targetRate: z.number().int().min(0),
    timeUnit: z.enum(TimeUnit),
  }),
});

const rampLoadProfileSchema = z.object({
  mode: z.literal(LoadMode.RAMP),
  config: z.object({
    initialRate: z.number().int().min(0),
    timeUnit: z.enum(TimeUnit),
    stages: z.array(stageSchema).min(1),
  }),
});

const stepCheckSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(CheckKind.STATUS_CODE),
    expected: z.number().int(),
  }),
  z.object({
    kind: z.literal(CheckKind.RESPONSE_TIME_LT),
    maxMs: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal(CheckKind.BODY_CONTAINS),
    value: z.string(),
  }),
  z.object({
    kind: z.literal(CheckKind.JSON_PATH_EQUALS),
    path: z.string().min(1),
    expected: z.union([z.string(), z.number(), z.boolean()]),
  }),
]);

const stepSchema = z.object({
  path: z.string().min(1),
  method: z.enum(HttpMethod),
  checks: z.array(stepCheckSchema).default([]),
  body: z.record(z.string(), z.unknown()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

const secretRefSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1),
});

const authHttpRequestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
  path: z.string().min(1),
  headers: z
    .array(z.object({ name: z.string().min(1), value: z.string() }))
    .optional(),
  queryParams: z
    .array(z.object({ name: z.string().min(1), value: z.string() }))
    .optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  timeoutMs: z.number().int().min(1).optional(),
});

const authStrategySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(AuthStrategyKind.NONE) }),
  z.object({
    kind: z.literal(AuthStrategyKind.BEARER_TOKEN),
    tokenRef: secretRefSchema,
  }),
  z.object({
    kind: z.literal(AuthStrategyKind.BASIC_AUTH),
    username: z.string().min(1),
    passwordRef: secretRefSchema,
  }),
  z.object({
    kind: z.literal(AuthStrategyKind.API_KEY_HEADER),
    headerName: z.string().min(1),
    valueRef: secretRefSchema,
  }),
  z.object({
    kind: z.literal(AuthStrategyKind.LOGIN_FLOW),
    loginRequest: authHttpRequestSchema,
    tokenExtraction: z.object({
      kind: z.literal("JSON_PATH"),
      path: z.string().min(1),
    }),
    applyAs: z.enum(["BEARER_TOKEN", "HEADER"]),
  }),
]);

const thresholdPolicySchema = z.object({
  maxErrorRate: z.number().min(0).max(1).optional(),
  maxP95ResponseTimeMs: z.number().int().min(1).optional(),
  maxP99ResponseTimeMs: z.number().int().min(1).optional(),
  minCheckSuccessRate: z.number().min(0).max(1).optional(),
  abortOnFail: z.boolean().default(false),
});

const executionPolicySchema = z.object({
  resourceProfile: z.enum(ResourceProfile),
  timeoutSeconds: z.number().int().min(1),
  cpuMillicores: z.number().int().min(1).optional(),
  memoryMb: z.number().int().min(1).optional(),
});

export const newTestCaseSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  ownerType: z.enum(TestCaseOwnerType),
  ownerId: z.uuid(),
  testType: z.enum(TestType),
  targetSystem: z.object({
    baseUrl: z.url(),
    environment: z.string().min(1),
  }),
  authStrategy: authStrategySchema,
  loadProfile: z.discriminatedUnion("mode", [
    constantLoadProfileSchema,
    rampLoadProfileSchema,
  ]),
  thresholdPolicy: thresholdPolicySchema,
  executionPolicy: executionPolicySchema,
  steps: z.array(stepSchema).default([]),
});

export type NewTestCaseInput = z.infer<typeof newTestCaseSchema>;
