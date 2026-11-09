import { BaseError } from "@/errors/base.error";
import type { BaseErrorDetails } from "@/errors/base.error";

export const FileStorageErrorCode = {
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_READ_FAILED: "FILE_READ_FAILED",
  FILE_WRITE_FAILED: "FILE_WRITE_FAILED",
  FILE_DELETE_ERROR: "FILE_DELETE_ERROR",
  FILE_ALREADY_EXISTS: "FILE_ALREADY_EXISTS",
  INVALID_FILE_FORMAT: "INVALID_FILE_FORMAT",
  ENCRYPTION_FAILED: "ENCRYPTION_FAILED",
  DECRYPTION_FAILED: "DECRYPTION_FAILED",
  INVALID_PIN: "INVALID_PIN",
  PIN_MISMATCH: "PIN_MISMATCH",
  INVALID_SALT: "INVALID_SALT",
  SALT_MISMATCH: "SALT_MISMATCH",
  INVALID_KEY: "INVALID_KEY",
  KEY_DERIVATION_FAILED: "KEY_DERIVATION_FAILED",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  DATABASE_ERROR: "DATABASE_ERROR",
  FILE_CORRUPTED: "FILE_CORRUPTED",
  INVALID_FILE_NAME: "INVALID_FILE_NAME",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  STORAGE_QUOTA_EXCEEDED: "STORAGE_QUOTA_EXCEEDED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type FileStorageErrorCode = (typeof FileStorageErrorCode)[keyof typeof FileStorageErrorCode];

export interface FileStorageErrorDetails extends BaseErrorDetails {
  code: FileStorageErrorCode;
}

export class FileStorageError extends BaseError {
  public readonly code: FileStorageErrorCode;

  constructor(details: FileStorageErrorDetails) {
    super(details);
    this.code = details.code;
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
      FileStorageErrorCode.FILE_READ_FAILED,
      `Failed to read file: ${fileName}`,
      { originalError, fileName, operation: "read" }
    );
  }

  static fileWriteError(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_WRITE_FAILED,
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
      FileStorageErrorCode.ENCRYPTION_FAILED,
      `Encryption failed: ${message}`,
      { originalError, operation: "encrypt" }
    );
  }

  static decryptionError(message: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.DECRYPTION_FAILED,
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

  static fileReadFailed(fileName: string, originalError?: Error): FileStorageError {
    return FileStorageError.create(
      FileStorageErrorCode.FILE_READ_FAILED,
      `Failed to read file: ${fileName}`,
      { originalError, fileName, operation: "read" }
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