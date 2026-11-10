import { createHmac, randomUUID } from 'node:crypto';
import Organization from '#modules/identity/models/organization';
import User from '#modules/identity/models/user';
import env from '#start/env';

export const TEST_PASSWORD = 'Str0ng!Passw0rd';

export async function createUser(overrides: Partial<User> = {}) {
  const suffix = randomUUID().slice(0, 8);
  return User.create({
    name: 'Test User',
    nickname: `user-${suffix}`,
    email: `user-${suffix}@example.com`,
    passwordHash: TEST_PASSWORD,
    orgId: null,
    role: null,
    ...overrides,
  });
}

export async function createUserInOrganization() {
  const owner = await createUser();
  const organization = await Organization.create({
    name: 'Acme',
    ownerId: owner.id,
  });
  owner.orgId = organization.id;
  await owner.save();
  return { user: owner, organization };
}

/**
 * Signs a runner callback body the way ops/k6-runner/run.sh does:
 * `sha256=HMAC(secret, "<unix seconds>.<raw body>")`.
 */
export function signRunnerCallback(
  rawBody: string,
  options: { timestamp?: number; secret?: string } = {},
) {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = options.secret ?? env.get('RUNNER_SHARED_SECRET').release();
  const signature = `sha256=${createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')}`;

  return {
    'x-runner-timestamp': String(timestamp),
    'x-runner-signature': signature,
  };
}
