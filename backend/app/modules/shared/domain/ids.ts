import { v7 as uuidv7 } from 'uuid';
import type { UUID } from './types.js';

/**
 * Time-ordered ids, as the Bun backend generated with `randomUUIDv7`. v7 keeps
 * primary-key inserts roughly sequential, which plain v4 UUIDs do not.
 */
export function newId(): UUID {
  return uuidv7();
}
