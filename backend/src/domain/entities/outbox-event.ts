import { randomUUIDv7 } from 'bun';

import type {
  OutboxEventEnum,
  OutboxEventMap,
} from '@/domain/events/outbox-event-map';

export enum OutboxEventStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

interface OutboxEventConstructorArgs {
  id: string;
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  createdAt: Date;
  nextAttemptAt?: Date;
  processingStartedAt?: Date;
  publishedAt?: Date;
  lastError?: string;
}

export class OutboxEvent {
  id: string;
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  createdAt: Date;
  nextAttemptAt?: Date;
  processingStartedAt?: Date;
  publishedAt?: Date;
  lastError?: string;

  constructor(args: OutboxEventConstructorArgs) {
    this.id = args.id;
    this.type = args.type;
    this.aggregateId = args.aggregateId;
    this.payload = args.payload;
    this.status = args.status;
    this.attempts = args.attempts;
    this.createdAt = args.createdAt;
    this.nextAttemptAt = args.nextAttemptAt;
    this.processingStartedAt = args.processingStartedAt;
    this.publishedAt = args.publishedAt;
    this.lastError = args.lastError;
  }

  markProcessing() {
    this.status = OutboxEventStatus.PROCESSING;
    this.processingStartedAt = new Date();
  }

  markFailed(errorMessage: string) {
    this.status = OutboxEventStatus.FAILED;
    this.attempts += 1;
    this.processingStartedAt = undefined;
    this.nextAttemptAt = undefined;
    this.lastError = errorMessage;
  }

  registerDispatchFailure(
    errorMessage: string,
    maxAttempts: number,
    now = new Date(),
  ) {
    this.attempts += 1;
    this.lastError = errorMessage;
    this.processingStartedAt = undefined;

    if (this.attempts >= maxAttempts) {
      this.status = OutboxEventStatus.FAILED;
      this.nextAttemptAt = undefined;
      return;
    }

    const backoffSeconds = Math.min(2 ** this.attempts * 5, 300);

    this.status = OutboxEventStatus.PENDING;
    this.nextAttemptAt = new Date(now.getTime() + backoffSeconds * 1000);
  }

  static create(args: {
    type: OutboxEventEnum;
    aggregateId: string;
    payload: OutboxEventMap[OutboxEventEnum];
  }): OutboxEvent;

  static create<TType extends OutboxEventEnum>(args: {
    type: TType;
    aggregateId: string;
    payload: OutboxEventMap[TType];
  }): OutboxEvent;

  static create(args: {
    type: OutboxEventEnum;
    aggregateId: string;
    payload: OutboxEventMap[OutboxEventEnum];
  }) {
    return new OutboxEvent({
      id: randomUUIDv7(),
      type: args.type,
      aggregateId: args.aggregateId,
      payload: args.payload,
      status: OutboxEventStatus.PENDING,
      attempts: 0,
      createdAt: new Date(),
      nextAttemptAt: new Date(),
    });
  }
}
