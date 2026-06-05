import { describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import { AuthenticationError } from '@/domain/errors/custom-errors';
import { verifyRunnerCallbackSignature } from '@/infra/http/security/runner-callback-signature';

describe('verifyRunnerCallbackSignature', () => {
  const secret = 'shared-secret';
  const rawBody = JSON.stringify({ testRunId: crypto.randomUUID() });

  it('accepts valid signature and timestamp', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = `sha256=${createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')}`;

    expect(() =>
      verifyRunnerCallbackSignature({
        rawBody,
        timestampHeader: timestamp,
        signatureHeader: signature,
        sharedSecret: secret,
      }),
    ).not.toThrow();
  });

  it('rejects invalid signature', () => {
    expect(() =>
      verifyRunnerCallbackSignature({
        rawBody,
        timestampHeader: Math.floor(Date.now() / 1000).toString(),
        signatureHeader: 'sha256=invalid',
        sharedSecret: secret,
      }),
    ).toThrow(AuthenticationError);
  });
});
