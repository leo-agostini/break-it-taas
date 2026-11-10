import vine from '@vinejs/vine';
import {
  executionPolicyOverrideSchema,
  loadPresetSchema,
  loadProfileSchema,
} from './run_configuration_schemas.js';

/**
 * Body of `POST /api/test-runs/:testCaseId`. Everything is optional: an empty
 * body reruns the test case's default configuration.
 */
export const createTestRunValidator = vine.create({
  loadProfile: loadProfileSchema.optional(),
  loadPreset: loadPresetSchema.optional(),
  executionPolicy: executionPolicyOverrideSchema.optional(),
});
