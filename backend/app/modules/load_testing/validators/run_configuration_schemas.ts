import vine from '@vinejs/vine';
import {
  MAX_CPU_MILLICORES,
  MAX_MEMORY_MB,
  ResourceProfile,
} from '../domain/vos/execution_policy.js';
import { LoadMode, TimeUnit } from '../domain/vos/load_profile.js';
import { discriminator, integer, unknownVariant } from './helpers.js';

/*
| Structural schemas for a run configuration — load and runner container —
| shared by the test case payload (its defaults) and the test run payload
| (a per-run override). Cross-field rules live in buildRunConfiguration.
*/

const stage = vine.object({
  target: integer().min(0),
  duration: integer().min(1),
});

const timeUnit = () => vine.enum(Object.values(TimeUnit));

/** Optional VU pool for the arrival-rate modes. */
const vuPool = () =>
  vine
    .object({
      preAllocated: integer().min(1),
      max: integer().min(1),
    })
    .optional();

export const loadProfileSchema = vine
  .union([
    vine.union.if(
      discriminator('mode', LoadMode.CONSTANT),
      vine.object({
        mode: vine.literal(LoadMode.CONSTANT),
        config: vine.object({
          duration: integer().min(1),
          targetRate: integer().min(0),
          timeUnit: timeUnit(),
          vus: vuPool(),
        }),
      }),
    ),
    vine.union.if(
      discriminator('mode', LoadMode.RAMP),
      vine.object({
        mode: vine.literal(LoadMode.RAMP),
        config: vine.object({
          initialRate: integer().min(0),
          timeUnit: timeUnit(),
          stages: vine.array(stage).minLength(1),
          vus: vuPool(),
        }),
      }),
    ),
    vine.union.if(
      discriminator('mode', LoadMode.CONSTANT_VUS),
      vine.object({
        mode: vine.literal(LoadMode.CONSTANT_VUS),
        config: vine.object({
          vus: integer().min(1),
          duration: integer().min(1),
          timeUnit: timeUnit(),
        }),
      }),
    ),
    vine.union.if(
      discriminator('mode', LoadMode.RAMPING_VUS),
      vine.object({
        mode: vine.literal(LoadMode.RAMPING_VUS),
        config: vine.object({
          startVus: integer().min(0),
          timeUnit: timeUnit(),
          stages: vine.array(stage).minLength(1),
        }),
      }),
    ),
  ])
  .otherwise(unknownVariant('mode'));

export const loadPresetSchema = vine.object({
  peakRate: integer().min(1).optional(),
  peakVus: integer().min(1).optional(),
  duration: integer().min(1),
  timeUnit: timeUnit(),
});

const cpuMillicores = () => integer().min(1).max(MAX_CPU_MILLICORES);
const memoryMb = () => integer().min(1).max(MAX_MEMORY_MB);

export const executionPolicySchema = vine.object({
  resourceProfile: vine.enum(Object.values(ResourceProfile)),
  timeoutSeconds: integer().min(1),
  cpuMillicores: cpuMillicores().optional(),
  memoryMb: memoryMb().optional(),
});

/** Every field optional: unset fields keep the test case's default. */
export const executionPolicyOverrideSchema = vine.object({
  resourceProfile: vine.enum(Object.values(ResourceProfile)).optional(),
  timeoutSeconds: integer().min(1).optional(),
  cpuMillicores: cpuMillicores().optional(),
  memoryMb: memoryMb().optional(),
});
