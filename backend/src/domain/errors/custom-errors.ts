import { BaseError } from '@/domain/errors/base-error';

export class NotFoundError extends BaseError {
  constructor(
    message: string,
    description = 'The requested resource does not exist.',
    help = 'Verify the resource identifier and try again.',
  ) {
    super(message, {
      code: 'NOT_FOUND',
      description,
      help,
    });
  }
}

export class ValidationError extends BaseError {
  constructor(
    message: string,
    description = 'One or more request values are invalid.',
    help = 'Review the request payload and ensure all fields satisfy the expected format.',
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      description,
      help,
    });
  }
}

export class InvariantViolationError extends BaseError {
  constructor(
    message: string,
    description = 'The operation violates a domain invariant.',
    help = 'Check the current resource state before performing this operation.',
  ) {
    super(message, {
      code: 'INVARIANT_VIOLATION',
      description,
      help,
    });
  }
}

export class ConfigurationError extends BaseError {
  constructor(
    message: string,
    description = 'A required server configuration is missing or invalid.',
    help = 'Set all required environment variables and restart the service.',
  ) {
    super(message, {
      code: 'CONFIGURATION_ERROR',
      description,
      help,
    });
  }
}

export class LoadProfileCompatibilityError extends ValidationError {
  constructor(message: string) {
    super(
      message,
      'The selected load profile mode is incompatible with the selected test type.',
      'Choose a compatible combination of testType and loadProfile.mode.',
    );
  }
}

export class OutboxEventPayloadError extends ValidationError {
  constructor(message: string) {
    super(
      message,
      'An outbox event payload is malformed or missing required fields.',
      'Ensure the event payload includes all required properties before publishing.',
    );
  }
}
