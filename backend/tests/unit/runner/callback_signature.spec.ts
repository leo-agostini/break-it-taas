import { createHmac } from 'node:crypto';
import { test } from '@japa/runner';
import { verifyRunnerCallbackSignature } from '#modules/runner/callback_signature';
import { AuthenticationError } from '#modules/shared/domain/errors';

test.group('verifyRunnerCallbackSignature', () => {
  const secret = 'shared-secret';
  const rawBody = JSON.stringify({ testRunId: crypto.randomUUID() });

  test('accepts valid signature and timestamp', ({ expect }) => {
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

  test('rejects invalid signature', ({ expect }) => {
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
