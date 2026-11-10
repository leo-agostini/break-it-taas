/**
 * Self-signup password strength policy. Returns the first rule the password
 * breaks, or null when it satisfies all of them, so callers can report one
 * precise reason instead of a generic "invalid format".
 */
export function passwordPolicyViolation(password: string): string | null {
  if (password.length < 12) {
    return 'Password must be at least 12 characters long';
  }
  if (/\s/.test(password)) return 'Password cannot contain whitespace';
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/\d/.test(password)) return 'Password must contain at least one digit';
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one symbol';
  }
  return null;
}
