import { errors as authErrors } from '@adonisjs/auth';
import { errors as vineErrors } from '@vinejs/vine';
import { BaseError } from '#modules/shared/domain/base_error';

type HttpErrorBody = {
  error: {
    code: string;
    message: string;
    description?: string;
    help?: string;
  };
};

export interface MappedHttpError {
  status: number;
  body: HttpErrorBody;
}

const statusByCode: Record<string, number> = {
  NOT_FOUND: 404,
  AUTHENTICATION_ERROR: 401,
  VALIDATION_ERROR: 422,
  INVARIANT_VIOLATION: 409,
  AUTHORIZATION_ERROR: 403,
  CONFIGURATION_ERROR: 500,
};

const fromBaseError = (error: BaseError): MappedHttpError => ({
  status: statusByCode[error.code] ?? 400,
  body: {
    error: {
      code: error.code,
      message: error.message,
      description: error.description,
      help: error.help,
    },
  },
});

/**
 * The single place where an error becomes an HTTP status (ADR-003).
 *
 * Domain errors carry a `code` and no status. Framework errors that reach the
 * handler (failed validation, missing session, bad credentials) are folded into
 * the same `{ error: { code, message, ... } }` body so the frontend only ever
 * parses one error shape.
 */
export function mapErrorToHttp(error: unknown): MappedHttpError {
  if (error instanceof BaseError) {
    return fromBaseError(error);
  }

  if (error instanceof vineErrors.E_VALIDATION_ERROR) {
    const messages = error.messages as Array<{
      field: string;
      message: string;
    }>;
    const detail = messages
      .map((issue) => `${issue.field || 'payload'}: ${issue.message}`)
      .join('; ');

    return {
      status: 422,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: detail || 'Invalid request payload',
          description: 'One or more request values are invalid.',
          help: 'Review the request payload and ensure all fields satisfy the expected format.',
        },
      },
    };
  }

  if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
    return {
      status: 401,
      body: {
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid email or password',
          description:
            'The request is missing valid authentication credentials.',
          help: 'Check the email and password and try again.',
        },
      },
    };
  }

  if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
    return {
      status: 401,
      body: {
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication is required to access this resource',
          description:
            'The request is missing valid authentication credentials.',
          help: 'Log in to obtain a session and send its cookie with the request.',
        },
      },
    };
  }

  // Other framework HTTP exceptions (malformed JSON body, payload too large)
  // already know their client-error status; keep it rather than answering 500.
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return {
      status,
      body: {
        error: {
          code: 'BAD_REQUEST',
          message:
            error instanceof Error ? error.message : 'The request is invalid',
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected internal server error',
        description:
          'An unexpected error happened while processing the request.',
        help: 'Retry the request. If the issue persists, contact support.',
      },
    },
  };
}
