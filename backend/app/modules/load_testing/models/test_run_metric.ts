import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm';
import type { DateTime } from 'luxon';
import { newId } from '#modules/shared/domain/ids';
import type { UUID } from '#modules/shared/domain/types';
import { decimal } from '#modules/shared/models/columns';

/** Normalized metrics of a finished run (see domain/k6_result_metrics.ts). */
export default class TestRunMetric extends BaseModel {
  static table = 'test_run_metrics';
  static selfAssignPrimaryKey = true;

  @column({ isPrimary: true })
  declare id: UUID;

  @column()
  declare testRunId: UUID;

  @column()
  declare status: string;

  @column()
  declare runtimeRef: string | null;

  @column.dateTime()
  declare completedAt: DateTime | null;

  @column(decimal)
  declare requestedRate: number | undefined;

  @column()
  declare requestedTimeUnit: string | null;

  @column()
  declare requestedDurationSeconds: number | null;

  @column()
  declare requestedVus: number | null;

  @column(decimal)
  declare achievedRps: number | undefined;

  @column()
  declare peakVus: number | null;

  @column()
  declare totalRequests: number | null;

  @column()
  declare droppedIterations: number | null;

  @column(decimal)
  declare failureRate: number | undefined;

  @column(decimal)
  declare successRate: number | undefined;

  // Lucid's snake_case strategy would map this to "p_95_ms".
  @column({ ...decimal, columnName: 'p95_ms' })
  declare p95Ms: number | undefined;

  // Lucid's snake_case strategy would map this to "p_99_ms".
  @column({ ...decimal, columnName: 'p99_ms' })
  declare p99Ms: number | undefined;

  @column(decimal)
  declare medianMs: number | undefined;

  @column()
  declare generatorLimited: boolean;

  @column()
  declare timeoutsDetected: boolean;

  @column()
  declare aborted: boolean;

  @column(decimal)
  declare breakingPointRate: number | undefined;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;

  @beforeCreate()
  static assignId(metric: TestRunMetric) {
    metric.id ??= newId();
  }
}
