import type { DateTime } from 'luxon';

/**
 * Timestamps go over the wire exactly as the pre-Adonis API sent them
 * (`Date#toJSON`, UTC with a `Z` suffix), so the frontend parses one format.
 */
export function toIso(value: DateTime): string;
export function toIso(value: DateTime | null | undefined): string | undefined;
export function toIso(value: DateTime | null | undefined): string | undefined {
  return value ? value.toJSDate().toISOString() : undefined;
}
