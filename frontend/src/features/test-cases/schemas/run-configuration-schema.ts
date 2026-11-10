import { LOAD_MODES, isRateMode } from '@/features/test-cases/lib/load-profile';
import {
  loadModesByTestType,
  supportsVuLoad,
} from '@/features/test-cases/lib/status';
import type { TestType } from '@/features/test-cases/types/test-case';
import { z } from 'zod';

/*
| Form fields for a run configuration — the load and the runner container —
| shared by the test case form (its default) and the new run dialog (a per-run
| override). Mirrors backend run_configuration_schemas.
*/

export const TIME_UNITS = ['SECONDS', 'MINUTES', 'HOURS'] as const;
export const RESOURCE_PROFILES = [
  'SMALL',
  'MEDIUM',
  'LARGE',
  'CUSTOM',
] as const;

/** Upper bounds the backend enforces on a CUSTOM runner container. */
export const MAX_CPU_MILLICORES = 8000;
export const MAX_MEMORY_MB = 16384;

// Numeric inputs stay strings in the form and are converted by the mapper —
// this keeps zod's input and output types identical, which react-hook-form needs.
export const numericString = (message = 'Must be a number') =>
  z
    .string()
    .min(1, 'Required')
    .refine((value) => Number.isFinite(Number(value)), message);

export const optionalNumericString = z
  .string()
  .optional()
  .refine(
    (value) => !value || value.trim() === '' || Number.isFinite(Number(value)),
    'Must be a number',
  );

const stagesSchema = z
  .array(
    z.object({
      target: numericString(),
      duration: numericString(),
    }),
  )
  .min(1, 'Add at least one stage');

/** Optional VU pool for the arrival-rate modes; blank lets the runner size it. */
const vuPoolSchema = z.object({
  preAllocated: optionalNumericString,
  max: optionalNumericString,
});

export const loadFieldsShape = {
  // PRESET lets the backend derive the k6-recommended shape for the test type;
  // MANUAL keeps the hand-authored profile below.
  loadSource: z.enum(['PRESET', 'MANUAL']),
  preset: z.object({
    // Whether the peak is an arrival rate or a number of virtual users.
    driver: z.enum(['RATE', 'VUS']),
    peak: numericString(),
    duration: numericString(),
    timeUnit: z.enum(TIME_UNITS),
  }),
  loadMode: z.enum(LOAD_MODES),
  constant: z.object({
    targetRate: numericString(),
    duration: numericString(),
    timeUnit: z.enum(TIME_UNITS),
    vus: vuPoolSchema,
  }),
  ramp: z.object({
    initialRate: numericString(),
    timeUnit: z.enum(TIME_UNITS),
    stages: stagesSchema,
    vus: vuPoolSchema,
  }),
  constantVus: z.object({
    vus: numericString(),
    duration: numericString(),
    timeUnit: z.enum(TIME_UNITS),
  }),
  rampingVus: z.object({
    startVus: numericString(),
    timeUnit: z.enum(TIME_UNITS),
    stages: stagesSchema,
  }),
};

/** A test case's default container: every field it runs with is required. */
export const executionSchema = z.object({
  resourceProfile: z.enum(RESOURCE_PROFILES),
  timeoutSeconds: numericString(),
  cpuMillicores: optionalNumericString,
  memoryMb: optionalNumericString,
});

/** A per-run override: a blank timeout keeps the default, grown to fit the load. */
export const executionOverrideSchema = executionSchema.extend({
  timeoutSeconds: optionalNumericString,
});

export const runConfigurationFormSchema = z.object({
  ...loadFieldsShape,
  execution: executionOverrideSchema,
});

/**
 * The fields both forms share. The test case form's values are assignable to
 * this (its timeout is merely required), so the shared field components read
 * either form through it.
 */
export type RunConfigurationFormValues = z.infer<
  typeof runConfigurationFormSchema
>;

/**
 * Cross-field rules, mirroring the backend so a bad pairing is caught here
 * instead of coming back as a 422.
 */
export function refineRunConfiguration(
  values: RunConfigurationFormValues,
  testType: TestType,
  ctx: z.RefinementCtx,
) {
  if (values.loadSource === 'PRESET') {
    if (values.preset.driver === 'VUS' && !supportsVuLoad(testType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['preset', 'driver'],
        message: `${testType} needs a peak rate: its result is the arrival rate the target breaks at.`,
      });
    }
  } else {
    // A derived profile is compatible by construction, so this only applies to
    // hand-authored load.
    const allowed = loadModesByTestType[testType];
    if (!allowed.includes(values.loadMode)) {
      ctx.addIssue({
        code: 'custom',
        path: ['loadMode'],
        message: `${testType} test cases only support ${allowed.join(', ')} load.`,
      });
    }

    if (isRateMode(values.loadMode)) {
      const group = values.loadMode === 'CONSTANT' ? 'constant' : 'ramp';
      const { preAllocated, max } = values[group].vus;
      const hasPreAllocated = !!preAllocated?.trim();
      const hasMax = !!max?.trim();
      if (hasPreAllocated !== hasMax) {
        ctx.addIssue({
          code: 'custom',
          path: [group, 'vus', hasPreAllocated ? 'max' : 'preAllocated'],
          message: 'Set both, or neither to let the runner size the pool',
        });
      } else if (hasPreAllocated && Number(max) < Number(preAllocated)) {
        ctx.addIssue({
          code: 'custom',
          path: [group, 'vus', 'max'],
          message: 'Must be at least the pre-allocated VUs',
        });
      }
    }
  }

  if (values.execution.resourceProfile === 'CUSTOM') {
    const requireWithin = (
      field: 'cpuMillicores' | 'memoryMb',
      max: number,
    ) => {
      const raw = values.execution[field];
      if (!raw?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['execution', field],
          message: 'Required for CUSTOM profile',
        });
      } else if (Number(raw) < 1 || Number(raw) > max) {
        ctx.addIssue({
          code: 'custom',
          path: ['execution', field],
          message: `Must be between 1 and ${max}`,
        });
      }
    };
    requireWithin('cpuMillicores', MAX_CPU_MILLICORES);
    requireWithin('memoryMb', MAX_MEMORY_MB);
  }
}

export const defaultRunConfigurationValues: RunConfigurationFormValues = {
  loadSource: 'PRESET',
  preset: { driver: 'RATE', peak: '50', duration: '5', timeUnit: 'MINUTES' },
  loadMode: 'CONSTANT',
  constant: {
    targetRate: '10',
    duration: '30',
    timeUnit: 'SECONDS',
    vus: { preAllocated: '', max: '' },
  },
  ramp: {
    initialRate: '0',
    timeUnit: 'SECONDS',
    stages: [{ target: '50', duration: '30' }],
    vus: { preAllocated: '', max: '' },
  },
  constantVus: { vus: '10', duration: '30', timeUnit: 'SECONDS' },
  rampingVus: {
    startVus: '0',
    timeUnit: 'SECONDS',
    stages: [{ target: '20', duration: '30' }],
  },
  execution: {
    resourceProfile: 'SMALL',
    timeoutSeconds: '300',
    cpuMillicores: '',
    memoryMb: '',
  },
};
