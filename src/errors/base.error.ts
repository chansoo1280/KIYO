export interface BaseErrorDetails {
  code: string;
  message: string;
  originalError?: Error;
  fileName?: string;
  operation?: string;
  timestamp: number;
}

export class BaseError extends Error {
  public readonly code: string;
  public readonly originalError?: Error;
  public readonly fileName?: string;
  public readonly operation?: string;
  public readonly timestamp: number;

  constructor(details: BaseErrorDetails) {
    super(details.message);
    this.name = this.constructor.name;
    this.code = details.code;
    this.originalError = details.originalError;
    this.fileName = details.fileName;
    this.operation = details.operation;
    this.timestamp = details.timestamp;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      fileName: this.fileName,
      operation: this.operation,
      timestamp: this.timestamp,
      originalError: this.originalError?.message,
      stack: this.stack,
    };
  }
}

export function isBaseError<T extends BaseError>(
  error: unknown,
  errorClass: new (...args: unknown[]) => T
): error is T {
  return error instanceof errorClass;
}