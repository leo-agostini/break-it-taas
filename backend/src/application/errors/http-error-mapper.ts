import { BaseError } from '@/domain/errors/base-error';

type HttpErrorBody = {
  error: {
    code: string;
    message: string;
    description?: string;
    help?: string;
  };
};

interface MappedHttpError {
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

export function mapErrorToHttp(error: unknown): MappedHttpError {
  if (error instanceof BaseError) {
    return {
      status: statusByCode[error.code] ?? 400,
      body: {
        error: {
          code: error.code,
          message: error.message,
          description: error.description,
          help: error.help,
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
        description: 'An unexpected error happened while processing the request.',
        help: 'Retry the request. If the issue persists, contact support.',
      },
    },
  };
}
