import type { Knex } from 'knex';
import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { UserRepository } from '@/application/repositories/user-repository';
import { db } from '@/infra/db/knex';
import { User, type UserRole } from '@/domain/entities/user';

type UserRow = {
  id: UUID;
  name: string;
  nickname: string;
  photo_url: string | null;
  email: string;
  org_id: UUID | null;
  role: UserRole | null;
  password_hash: string;
  created_at: Date;
};

const USERS_TABLE = 'users';

const contextOrDb = (tx?: TransactionContext): Knex | Knex.Transaction => {
  return (tx as Knex.Transaction | undefined) ?? db;
};

const toEntity = (row: UserRow): User => {
  return new User({
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    photoUrl: row.photo_url,
    email: row.email,
    orgId: row.org_id,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  });
};

export class KnexUserRepository implements UserRepository {
  async findByEmail(email: string, tx?: TransactionContext): Promise<User | null> {
    const conn = contextOrDb(tx);
    const normalizedEmail = email.trim().toLowerCase();
    const row = await conn<UserRow>(USERS_TABLE)
      .where({ email: normalizedEmail })
      .first();

    if (!row) return null;
    return toEntity(row);
  }

  async create(user: User, tx?: TransactionContext): Promise<void> {
    const conn = contextOrDb(tx);

    await conn<UserRow>(USERS_TABLE).insert({
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      photo_url: user.photoUrl,
      email: user.email,
      org_id: user.orgId,
      role: user.role,
      password_hash: user.passwordHash,
      created_at: user.createdAt,
    });
  }
}
