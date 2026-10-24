import { ValidationError } from '#modules/shared/domain/errors';

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Invariants a user must satisfy before it is persisted, whichever path
 * created it. Request validation rejects most of these earlier; this is the
 * guarantee that holds even for code that skips the validator.
 */
export function assertValidUserProfile(profile: {
  name: string;
  nickname: string;
  email: string;
}): void {
  if (!profile.name.trim()) throw new ValidationError('User name is required');
  if (!profile.nickname.trim()) {
    throw new ValidationError('User nickname is required');
  }
  if (!profile.email.trim()) {
    throw new ValidationError('User email is required');
  }
}

export function normalizeOrganizationName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ValidationError('Organization name is required');
  }
  return trimmed;
}
