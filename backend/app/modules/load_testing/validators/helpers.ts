import vine from '@vinejs/vine';
import type { FieldContext } from '@vinejs/vine/types';

/* Building blocks shared by the load-testing validators. */

export const integer = () => vine.number({ strict: true }).withoutDecimals();
export const ratio = () => vine.number({ strict: true }).min(0).max(1);

export const discriminator =
  (key: string, expected: string) =>
  (value: unknown): boolean =>
    vine.helpers.isObject(value) &&
    (value as Record<string, unknown>)[key] === expected;

export const unknownVariant =
  (key: string) => (_value: unknown, field: FieldContext) =>
    field.report(
      `The ${field.getFieldPath() || 'value'}.${key} is not a supported value`,
      'union',
      field,
    );
