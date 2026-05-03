import { randomUUIDv7 } from 'bun';

import type {
  OutboxEventMap,
  OutboxEventEnum,
} from '@/domain/events/outbox-event-map';

export enum OutboxEventStatus {
  PENDING = 'PENDING',
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
    this.publishedAt = args.publishedAt;
    this.lastError = args.lastError;
  }

  markPublished() {
    this.status = OutboxEventStatus.PUBLISHED;
    this.publishedAt = new Date();
    this.lastError = undefined;
  }

  markFailed(errorMessage: string) {
    this.status = OutboxEventStatus.FAILED;
    this.attempts += 1;
    this.lastError = errorMessage;
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
    });
  }
}
