import vine from '@vinejs/vine';
import type { FieldContext } from '@vinejs/vine/types';
import { COMPLETION_STATUSES } from '../domain/test_run_status.js';

/**
 * ISO-8601 timestamp, kept as the string the runner sent: it is stored
 * verbatim in the run's result payload.
 */
const isoDateTime = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
      Number.isNaN(Date.parse(value))
    ) {
      field.report(
        'The {{ field }} field must be an ISO-8601 date-time',
        'isoDateTime',
        field,
      );
    }
  },
);

export const runnerCallbackValidator = vine.create({
  testRunId: vine.string().uuid(),
  status: vine.enum(COMPLETION_STATUSES),
  resultSummary: vine.record(vine.any()),
  artifacts: vine.array(vine.string()).optional(),
  runtimeRef: vine.string().minLength(1),
  completedAt: vine.string().use(isoDateTime()).optional(),
});
