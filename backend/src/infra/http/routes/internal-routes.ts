import { Elysia } from 'elysia';
import type { AppContainer } from '@/infra/http/container';
import { env } from '@/infra/config/env';
import { verifyRunnerCallbackSignature } from '@/infra/http/security/runner-callback-signature';
import { ValidationError } from '@/domain/errors/custom-errors';

export function createInternalRoutes(container: AppContainer) {
  return new Elysia({ prefix: '/api/internal' }).post(
    '/test-runs/callback',
    async ({ body, headers }) => {
      const rawBody = String(body ?? '');

      verifyRunnerCallbackSignature({
        rawBody,
        timestampHeader: headers['x-runner-timestamp'],
        signatureHeader: headers['x-runner-signature'],
        sharedSecret: env.RUNNER_SHARED_SECRET,
      });

      let payload: unknown;

      try {
        payload = JSON.parse(rawBody);
      } catch {
        throw new ValidationError('Runner callback body must be valid JSON');
      }

      const result = await container.completeTestRunFromCallbackUseCase.execute(
        payload,
      );

      return {
        status: 'accepted',
        updated: result.updated,
      };
    },
    {
      parse: 'text',
      detail: {
        hide: true,
        tags: ['internal'],
      },
    },
  );
}
