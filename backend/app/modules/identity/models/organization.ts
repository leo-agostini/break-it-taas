import {
  BaseModel,
  beforeCreate,
  beforeSave,
  column,
} from '@adonisjs/lucid/orm';
import type { DateTime } from 'luxon';
import { normalizeOrganizationName } from '#modules/identity/domain/user_profile';
import { newId } from '#modules/shared/domain/ids';
import type { UUID } from '#modules/shared/domain/types';

export default class Organization extends BaseModel {
  static selfAssignPrimaryKey = true;

  @column({ isPrimary: true })
  declare id: UUID;

  @column()
  declare name: string;

  @column({ columnName: 'owner_user_id' })
  declare ownerId: UUID | null;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @beforeCreate()
  static assignId(organization: Organization) {
    organization.id ??= newId();
  }

  @beforeSave()
  static normalizeName(organization: Organization) {
    organization.name = normalizeOrganizationName(organization.name);
  }
}
