/**
 * Column (de)serializers shared by the Lucid models.
 */

/**
 * For `jsonb` columns. The pg driver serializes a JS array as a Postgres
 * array literal, not as JSON, so arrays (e.g. `steps`) must be stringified on
 * the way in. Reads need nothing: pg already parses jsonb.
 */
export const jsonb = {
  prepare: (value: unknown) =>
    value === undefined || value === null ? value : JSON.stringify(value),
};

/**
 * For `decimal`/`numeric` columns, which pg returns as strings to avoid
 * precision loss. The metrics stored in them are well within double range.
 */
export const decimal = {
  consume: (value: unknown): number | undefined => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.length > 0) return Number(value);
    return undefined;
  },
};
