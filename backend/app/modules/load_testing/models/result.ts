import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm';
import type { DateTime } from 'luxon';
import { newId } from '#modules/shared/domain/ids';
import type { UUID } from '#modules/shared/domain/types';
import { jsonb } from '#modules/shared/models/columns';

/** The raw runner callback for a run, kept verbatim alongside the metrics. */
export default class Result extends BaseModel {
  static selfAssignPrimaryKey = true;

  @column({ isPrimary: true })
  declare id: UUID;

  @column()
  declare testRunId: UUID;

  @column(jsonb)
  declare payload: Record<string, unknown>;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @beforeCreate()
  static assignId(result: Result) {
    result.id ??= newId();
  }
}
