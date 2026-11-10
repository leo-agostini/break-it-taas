import type User from '#modules/identity/models/user';
import { toIso } from '#modules/shared/http/serialize';

export function presentCreatedUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    photoUrl: user.photoUrl ?? null,
    email: user.email,
    orgId: user.orgId ?? null,
    role: user.role ?? null,
    createdAt: toIso(user.createdAt),
  };
}

export function presentSessionUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    orgId: user.orgId ?? null,
  };
}
