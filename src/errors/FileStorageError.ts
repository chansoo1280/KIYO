export const FileStorageErrorCode = {
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  FILE_DELETE_ERROR: "FILE_DELETE_ERROR",
  FILE_ALREADY_EXISTS: "FILE_ALREADY_EXISTS",
  INVALID_FILE_FORMAT: "INVALID_FILE_FORMAT",
  INVALID_JSON: "INVALID_JSON",
  INVALID_FORMAT: "INVALID_FORMAT",
  ENCRYPTION_ERROR: "ENCRYPTION_ERROR",
  DECRYPTION_ERROR: "DECRYPTION_ERROR",
  INVALID_PIN: "INVALID_PIN",
  INVALID_SALT: "INVALID_SALT",
  INVALID_KEY: "INVALID_KEY",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  DATABASE_ERROR: "DATABASE_ERROR",
  INVALID_DATA_FORMAT: "INVALID_DATA_FORMAT",
  FILE_CORRUPTED: "FILE_CORRUPTED",
  PIN_MISMATCH: "PIN_MISMATCH",
  SALT_MISMATCH: "SALT_MISMATCH",
  KEY_DERIVATION_FAILED: "KEY_DERIVATION_FAILED",
  ENCRYPTION_FAILED: "ENCRYPTION_FAILED",
  DECRYPTION_FAILED: "DECRYPTION_FAILED",
  FILE_WRITE_FAILED: "FILE_WRITE_FAILED",
  WRITE_FAILED: "WRITE_FAILED",
  FILE_READ_FAILED: "FILE_READ_FAILED",
  DATABASE_CONNECTION_FAILED: "DATABASE_CONNECTION_FAILED",
  DATABASE_QUERY_FAILED: "DATABASE_QUERY_FAILED",
  INVALID_FILE_NAME: "INVALID_FILE_NAME",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  STORAGE_QUOTA_EXCEEDED: "STORAGE_QUOTA_EXCEEDED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type FileStorageErrorCode = (typeof FileStorageErrorCode)[keyof typeof FileStorageErrorCode];

export interface FileStorageErrorDetails {
  code: FileStorageErrorCode;
  message: string;
  originalError?: Error;
  fileName?: string;
  operation?: string;
  timestamp: number;
}

export class FileStorageError extends Error {
  public readonly code: FileStorageErrorCode;
  public readonly originalError?: Error;
  public readonly fileName?: string;
  public readonly operation?: string;
  public readonly timestamp: number;

  constructor(details: FileStorageErrorDetails) {
    super(details.message);
    this.name = "FileStorageError";
    this.code = details.code;
    this.originalError = details.originalError;
    this.fileName = details.fileName;
    this.operation = details.operation;
    this.timestamp = details.timestamp;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileStorageError);
    }
  }

  static create(
    code: FileStorageErrorCode,
    message: string,
    options?: {
      originalError?: Error;
      fileName?: string;
      operation?: string;
    }
  ): FileStorageError {
    return new FileStorageError({
      code,
      message,
      originalError: options?.originalError,
      fileName: options?.fileName,
      operation: options?.operation,
      timestamp: Date.now(),
    });
  }

  static fileNotFound(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_NOT_FOUND,
      `File not found: ${fileName}`,
      { originalError, fileName, operation: "read" }
    );
  }

  static fileReadError(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_READ_ERROR,
      `Failed to read file: ${fileName}`,
      { originalError, fileName, operation: "read" }
    );
  }

  static fileWriteError(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_WRITE_ERROR,
      `Failed to write file: ${fileName}`,
      { originalError, fileName, operation: "write" }
    );
  }

  static fileDeleteError(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_DELETE_ERROR,
      `Failed to delete file: ${fileName}`,
      { originalError, fileName, operation: "delete" }
    );
  }

  static fileAlreadyExists(fileName: string): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_ALREADY_EXISTS,
      `File already exists: ${fileName}`,
      { fileName, operation: "create" }
    );
  }

  static invalidFileFormat(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      `Invalid file format: ${fileName}`,
      { originalError, fileName, operation: "parse" }
    );
  }

  static encryptionError(message: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.ENCRYPTION_ERROR,
      `Encryption failed: ${message}`,
      { originalError, operation: "encrypt" }
    );
  }

  static decryptionError(message: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.DECRYPTION_ERROR,
      `Decryption failed: ${message}`,
      { originalError, operation: "decrypt" }
    );
  }

  static invalidPin(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.INVALID_PIN,
      "Invalid PIN provided",
      { originalError, operation: "verify_pin" }
    );
  }

  static invalidSalt(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.INVALID_SALT,
      "Invalid salt provided",
      { originalError, operation: "validate_salt" }
    );
  }

  static invalidKey(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.INVALID_KEY,
      "Invalid encryption key",
      { originalError, operation: "validate_key" }
    );
  }

  static storageUnavailable(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.STORAGE_UNAVAILABLE,
      "Storage is not available",
      { originalError, operation: "storage_access" }
    );
  }

  static permissionDenied(operation: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.PERMISSION_DENIED,
      `Permission denied for operation: ${operation}`,
      { originalError, operation }
    );
  }

  static databaseError(message: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.DATABASE_ERROR,
      `Database error: ${message}`,
      { originalError, operation: "database" }
    );
  }

  static invalidDataFormat(message: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.INVALID_DATA_FORMAT,
      `Invalid data format: ${message}`,
      { originalError, operation: "parse" }
    );
  }

  static fileCorrupted(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_CORRUPTED,
      `File is corrupted: ${fileName}`,
      { originalError, fileName, operation: "read" }
    );
  }

  static pinMismatch(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.PIN_MISMATCH,
      "PIN does not match",
      { originalError, operation: "verify_pin" }
    );
  }

  static saltMismatch(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.SALT_MISMATCH,
      "Salt does not match",
      { originalError, operation: "validate_salt" }
    );
  }

  static keyDerivationFailed(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.KEY_DERIVATION_FAILED,
      "Key derivation failed",
      { originalError, operation: "derive_key" }
    );
  }

  static encryptionFailed(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.ENCRYPTION_FAILED,
      "Encryption failed",
      { originalError, operation: "encrypt" }
    );
  }

  static decryptionFailed(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.DECRYPTION_FAILED,
      "Decryption failed",
      { originalError, operation: "decrypt" }
    );
  }

  static fileWriteFailed(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_WRITE_FAILED,
      `Failed to write file: ${fileName}`,
      { originalError, fileName, operation: "write" }
    );
  }

  static fileReadFailed(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_READ_FAILED,
      `Failed to read file: ${fileName}`,
      { originalError, fileName, operation: "read" }
    );
  }

  static databaseConnectionFailed(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.DATABASE_CONNECTION_FAILED,
      "Database connection failed",
      { originalError, operation: "database_connect" }
    );
  }

  static databaseQueryFailed(query: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.DATABASE_QUERY_FAILED,
      `Database query failed: ${query}`,
      { originalError, operation: "database_query" }
    );
  }

  static invalidFileName(fileName: string): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_NAME,
      `Invalid file name: ${fileName}`,
      { fileName, operation: "validate_filename" }
    );
  }

  static fileTooLarge(fileName: string, size: number, maxSize: number): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_TOO_LARGE,
      `File too large: ${fileName} (${size} bytes, max ${maxSize} bytes)`,
      { fileName, operation: "write" }
    );
  }

  static storageQuotaExceeded(originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.STORAGE_QUOTA_EXCEEDED,
      "Storage quota exceeded",
      { originalError, operation: "write" }
    );
  }

  static unknownError(message: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.UNKNOWN_ERROR,
      `Unknown error: ${message}`,
      { originalError, operation: "unknown" }
    );
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

export function isFileStorageError(error: unknown): error is FileStorageError {
  return error instanceof FileStorageError;
}

export function getErrorCode(error: unknown): FileStorageErrorCode | null {
  if (isFileStorageError(error)) {
    return error.code;
  }
  return null;
}

export function getErrorMessage(error: unknown): string {
  if (isFileStorageError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (error == null) {
    return "Unknown error";
  }
  return String(error);
}
