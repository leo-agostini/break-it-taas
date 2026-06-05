import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuthenticationError } from '@/domain/errors/custom-errors';

const MAX_CLOCK_SKEW_SECONDS = 300;

export function verifyRunnerCallbackSignature(input: {
  rawBody: string;
  timestampHeader?: string;
  signatureHeader?: string;
  sharedSecret: string;
  now?: Date;
}) {
  const timestamp = Number(input.timestampHeader);
  if (!Number.isFinite(timestamp)) {
    throw new AuthenticationError('Missing or invalid X-Runner-Timestamp');
  }

  const signature = input.signatureHeader;
  if (!signature || !signature.startsWith('sha256=')) {
    throw new AuthenticationError('Missing or invalid X-Runner-Signature');
  }

  const now = input.now ?? new Date();
  const ageSeconds = Math.abs(Math.floor(now.getTime() / 1000) - timestamp);
  if (ageSeconds > MAX_CLOCK_SKEW_SECONDS) {
    throw new AuthenticationError('Runner callback timestamp expired');
  }

  const expected = `sha256=${createHmac('sha256', input.sharedSecret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest('hex')}`;

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new AuthenticationError('Invalid runner callback signature');
  }
}
