import {
  defaultRunConfigurationValues,
  executionSchema,
  loadFieldsShape,
  optionalNumericString,
  refineRunConfiguration,
} from '@/features/test-cases/schemas/run-configuration-schema';
import { z } from 'zod';

const TEST_TYPES = [
  'SMOKE',
  'AVG_LOAD',
  'STRESS',
  'SOAK',
  'SPIKE',
  'BREAKPOINT',
] as const;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;
const AUTH_KINDS = [
  'NONE',
  'BEARER_TOKEN',
  'BASIC_AUTH',
  'API_KEY_HEADER',
  'LOGIN_FLOW',
] as const;

const rateString = z
  .string()
  .optional()
  .refine((value) => {
    if (!value || value.trim() === '') return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1;
  }, 'Must be between 0 and 1');

const secretRefSchema = z.object({
  provider: z.string().optional(),
  key: z.string().optional(),
});

const stepCheckSchema = z.object({
  kind: z.enum([
    'STATUS_CODE',
    'RESPONSE_TIME_LT',
    'BODY_CONTAINS',
    'JSON_PATH_EQUALS',
  ]),
  expected: z.string().optional(),
  maxMs: z.string().optional(),
  value: z.string().optional(),
  path: z.string().optional(),
});

const stepSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  method: z.enum(HTTP_METHODS),
  bodyJson: z.string().optional(),
  checks: z.array(stepCheckSchema).min(1, 'Add at least one check'),
});

export const newTestCaseFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    testType: z.enum(TEST_TYPES),

    baseUrl: z.string().url('Must be a valid URL'),
    environment: z.string().min(1, 'Environment is required'),

    auth: z.object({
      kind: z.enum(AUTH_KINDS),
      tokenRef: secretRefSchema,
      basicUsername: z.string().optional(),
      passwordRef: secretRefSchema,
      apiKeyHeaderName: z.string().optional(),
      valueRef: secretRefSchema,
      loginMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH']),
      loginPath: z.string().optional(),
      loginBodyJson: z.string().optional(),
      tokenExtractionPath: z.string().optional(),
      applyAs: z.enum(['BEARER_TOKEN', 'HEADER']),
    }),

    // The default load and container of the case's runs.
    ...loadFieldsShape,

    thresholds: z.object({
      maxErrorRate: rateString,
      minCheckSuccessRate: rateString,
      maxP95ResponseTimeMs: optionalNumericString,
      maxP99ResponseTimeMs: optionalNumericString,
      abortOnFail: z.boolean(),
    }),

    execution: executionSchema,

    steps: z.array(stepSchema).min(1, 'Add at least one step'),
  })
  .superRefine((values, ctx) => {
    refineRunConfiguration(values, values.testType, ctx);

    const requireSecretRef = (
      ref: { provider?: string; key?: string },
      path: string,
    ) => {
      if (!ref.provider?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['auth', path, 'provider'],
          message: 'Provider is required',
        });
      }
      if (!ref.key?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['auth', path, 'key'],
          message: 'Key is required',
        });
      }
    };

    const auth = values.auth;
    if (auth.kind === 'BEARER_TOKEN') {
      requireSecretRef(auth.tokenRef, 'tokenRef');
    }
    if (auth.kind === 'BASIC_AUTH') {
      if (!auth.basicUsername?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['auth', 'basicUsername'],
          message: 'Username is required',
        });
      }
      requireSecretRef(auth.passwordRef, 'passwordRef');
    }
    if (auth.kind === 'API_KEY_HEADER') {
      if (!auth.apiKeyHeaderName?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['auth', 'apiKeyHeaderName'],
          message: 'Header name is required',
        });
      }
      requireSecretRef(auth.valueRef, 'valueRef');
    }
    if (auth.kind === 'LOGIN_FLOW') {
      if (!auth.loginPath?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['auth', 'loginPath'],
          message: 'Login path is required',
        });
      }
      if (!auth.tokenExtractionPath?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['auth', 'tokenExtractionPath'],
          message: 'Token JSON path is required',
        });
      }
      if (auth.loginBodyJson?.trim()) {
        try {
          JSON.parse(auth.loginBodyJson);
        } catch {
          ctx.addIssue({
            code: 'custom',
            path: ['auth', 'loginBodyJson'],
            message: 'Must be valid JSON',
          });
        }
      }
    }

    values.steps.forEach((step, stepIndex) => {
      if (step.bodyJson?.trim()) {
        try {
          JSON.parse(step.bodyJson);
        } catch {
          ctx.addIssue({
            code: 'custom',
            path: ['steps', stepIndex, 'bodyJson'],
            message: 'Must be valid JSON',
          });
        }
      }

      step.checks.forEach((check, checkIndex) => {
        const requireField = (field: string, message: string) => {
          const value = check[field as keyof typeof check];
          if (typeof value !== 'string' || !value.trim()) {
            ctx.addIssue({
              code: 'custom',
              path: ['steps', stepIndex, 'checks', checkIndex, field],
              message,
            });
          }
        };

        if (check.kind === 'STATUS_CODE') {
          requireField('expected', 'Expected status is required');
        }
        if (check.kind === 'RESPONSE_TIME_LT') {
          requireField('maxMs', 'Max milliseconds is required');
        }
        if (check.kind === 'BODY_CONTAINS') {
          requireField('value', 'Value is required');
        }
        if (check.kind === 'JSON_PATH_EQUALS') {
          requireField('path', 'JSON path is required');
          requireField('expected', 'Expected value is required');
        }
      });
    });
  });

export type NewTestCaseFormValues = z.infer<typeof newTestCaseFormSchema>;

export const defaultNewTestCaseValues: NewTestCaseFormValues = {
  name: '',
  description: '',
  testType: 'SMOKE',
  baseUrl: 'https://',
  environment: 'staging',
  auth: {
    kind: 'NONE',
    tokenRef: { provider: '', key: '' },
    basicUsername: '',
    passwordRef: { provider: '', key: '' },
    apiKeyHeaderName: '',
    valueRef: { provider: '', key: '' },
    loginMethod: 'POST',
    loginPath: '',
    loginBodyJson: '',
    tokenExtractionPath: '',
    applyAs: 'BEARER_TOKEN',
  },
  ...defaultRunConfigurationValues,
  thresholds: {
    maxErrorRate: '0.05',
    minCheckSuccessRate: '0.95',
    maxP95ResponseTimeMs: '400',
    maxP99ResponseTimeMs: '800',
    abortOnFail: true,
  },
  execution: {
    ...defaultRunConfigurationValues.execution,
    timeoutSeconds: '300',
  },
  steps: [
    {
      path: '/health',
      method: 'GET',
      bodyJson: '',
      checks: [{ kind: 'STATUS_CODE', expected: '200' }],
    },
  ],
};

export { TEST_TYPES, HTTP_METHODS, AUTH_KINDS };
