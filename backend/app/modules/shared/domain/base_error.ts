export interface ErrorMetadata {
  code: string;
  description?: string;
  help?: string;
}

export class BaseError extends Error {
  readonly code: string;
  readonly description?: string;
  readonly help?: string;

  constructor(message: string, metadata: ErrorMetadata) {
    super(message);
    this.name = new.target.name;
    this.code = metadata.code;
    this.description = metadata.description;
    this.help = metadata.help;
  }
}
