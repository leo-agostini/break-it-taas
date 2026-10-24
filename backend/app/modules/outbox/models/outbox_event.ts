import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm';
import type { DateTime } from 'luxon';
import { newId } from '#modules/shared/domain/ids';
import type { UUID } from '#modules/shared/domain/types';
import { jsonb } from '#modules/shared/models/columns';
import type { OutboxEventStatus } from '../domain/dispatch_policy.js';

export default class OutboxEvent extends BaseModel {
  static selfAssignPrimaryKey = true;

  @column({ isPrimary: true })
  declare id: UUID;

  @column()
  declare type: string;

  @column()
  declare aggregateId: UUID;

  @column(jsonb)
  declare payload: Record<string, unknown>;

  @column()
  declare status: OutboxEventStatus;

  @column()
  declare attempts: number;

  @column.dateTime()
  declare nextAttemptAt: DateTime;

  @column.dateTime()
  declare processingStartedAt: DateTime | null;

  @column.dateTime()
  declare publishedAt: DateTime | null;

  @column()
  declare lastError: string | null;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @beforeCreate()
  static assignId(event: OutboxEvent) {
    event.id ??= newId();
  }
}
