export enum OutboxEventStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export const MAX_DISPATCH_ATTEMPTS = 8;
const MAX_BACKOFF_SECONDS = 300;

export type DispatchFailureOutcome =
  | { status: OutboxEventStatus.FAILED; attempts: number }
  | {
      status: OutboxEventStatus.PENDING;
      attempts: number;
      nextAttemptAt: Date;
    };

/**
 * What happens to an event whose dispatch just failed: retried with
 * exponential backoff (10s, 20s, 40s … capped at 5 minutes) until it has used
 * up `maxAttempts`, then parked as FAILED for a human to look at.
 */
export function afterDispatchFailure(args: {
  attemptsSoFar: number;
  maxAttempts?: number;
  now?: Date;
}): DispatchFailureOutcome {
  const attempts = args.attemptsSoFar + 1;
  const maxAttempts = args.maxAttempts ?? MAX_DISPATCH_ATTEMPTS;

  if (attempts >= maxAttempts) {
    return { status: OutboxEventStatus.FAILED, attempts };
  }

  const now = args.now ?? new Date();
  const backoffSeconds = Math.min(2 ** attempts * 5, MAX_BACKOFF_SECONDS);

  return {
    status: OutboxEventStatus.PENDING,
    attempts,
    nextAttemptAt: new Date(now.getTime() + backoffSeconds * 1000),
  };
}
