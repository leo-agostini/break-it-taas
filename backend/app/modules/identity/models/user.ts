import { withAuthFinder } from '@adonisjs/auth/mixins/lucid';
import { compose } from '@adonisjs/core/helpers';
import hash from '@adonisjs/core/services/hash';
import {
  BaseModel,
  beforeCreate,
  beforeSave,
  column,
} from '@adonisjs/lucid/orm';
import type { DateTime } from 'luxon';
import {
  type UserRole,
  assertValidUserProfile,
  normalizeEmail,
} from '#modules/identity/domain/user_profile';
import { newId } from '#modules/shared/domain/ids';
import type { UUID } from '#modules/shared/domain/types';

const AuthFinder = withAuthFinder(() => hash.use('argon'), {
  uids: ['email'],
  passwordColumnName: 'passwordHash',
});

export default class User extends compose(BaseModel, AuthFinder) {
  static selfAssignPrimaryKey = true;

  @column({ isPrimary: true })
  declare id: UUID;

  @column()
  declare name: string;

  @column()
  declare nickname: string;

  @column()
  declare photoUrl: string | null;

  @column()
  declare email: string;

  @column()
  declare orgId: UUID | null;

  @column()
  declare role: UserRole | null;

  /**
   * Assign the plain password; the auth finder's beforeSave hook hashes it
   * (argon2id, see config/hash.ts) before the row is written.
   */
  @column({ serializeAs: null })
  declare passwordHash: string;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @beforeCreate()
  static assignId(user: User) {
    user.id ??= newId();
  }

  @beforeSave()
  static normalizeProfile(user: User) {
    assertValidUserProfile(user);
    user.name = user.name.trim();
    user.nickname = user.nickname.trim();
    user.email = normalizeEmail(user.email);
  }
}
