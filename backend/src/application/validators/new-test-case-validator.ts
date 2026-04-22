import { TestCaseOwnerType, TestType } from "@/domain/entities/test-case";
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

export const newTestCaseSchema = z.object({
  name: z.string().min(1),
  ownerType: z.enum(TestCaseOwnerType),
  ownerId: z.string().uuid(),
  testType: z.enum(TestType),
  loadProfile: z.discriminatedUnion("mode", [
    constantLoadProfileSchema,
    rampLoadProfileSchema,
  ]),
  steps: z.array(stepSchema).default([]),
});

export type NewTestCaseInput = z.infer<typeof newTestCaseSchema>;
