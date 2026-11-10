import { inject } from '@adonisjs/core';
import type { HttpContext } from '@adonisjs/core/http';
import { verifyRunnerCallbackSignature } from '#modules/runner/callback_signature';
import { ValidationError } from '#modules/shared/domain/errors';
import env from '#start/env';
import type { RunnerCallback } from '../services/run_completion_service.js';
import { RunCompletionService } from '../services/run_completion_service.js';
import { runnerCallbackValidator } from '../validators/runner_callback_validator.js';

/**
 * The k6 runner's completion callback. It carries no session: it is
 * authenticated by an HMAC over the exact request bytes, checked before the
 * body is trusted for anything (see docs/02-architecture/hmac-explained.md).
 */
@inject()
export default class RunnerCallbackController {
  constructor(private readonly completion: RunCompletionService) {}

  async store({ request }: HttpContext) {
    const rawBody = request.raw() ?? '';

    verifyRunnerCallbackSignature({
      rawBody,
      timestampHeader: request.header('x-runner-timestamp'),
      signatureHeader: request.header('x-runner-signature'),
      sharedSecret: env.get('RUNNER_SHARED_SECRET').release(),
    });

    if (!request.raw()) {
      throw new ValidationError('Runner callback body must be valid JSON');
    }

    const callback = await runnerCallbackValidator.validate(request.body());
    const result = await this.completion.completeFromCallback(
      callback as RunnerCallback,
    );

    return {
      status: 'accepted',
      updated: result.updated,
    };
  }
}
