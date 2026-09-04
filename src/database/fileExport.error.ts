import { BaseError } from "@/errors/base.error";
import type { BaseErrorDetails } from "@/errors/base.error";

export const FileExportErrorCode = {
  INVALID_FILE_NAME: "EXPORT_INVALID_FILE_NAME",
  PERMISSION_DENIED: "EXPORT_PERMISSION_DENIED",
  URI_EXPIRED: "EXPORT_URI_EXPIRED",
  URI_INVALID: "EXPORT_URI_INVALID",
  USER_CANCELLED: "EXPORT_USER_CANCELLED",
  PROVIDER_UNAVAILABLE: "EXPORT_PROVIDER_UNAVAILABLE",
  WRITE_FAILED: "EXPORT_WRITE_FAILED",
  READ_FAILED: "EXPORT_READ_FAILED",
  FOLDER_PICK_FAILED: "EXPORT_FOLDER_PICK_FAILED",
  WEB_UNSUPPORTED: "EXPORT_WEB_UNSUPPORTED",
  UNKNOWN_ERROR: "EXPORT_UNKNOWN_ERROR",
} as const;

export type FileExportErrorCode = (typeof FileExportErrorCode)[keyof typeof FileExportErrorCode];

export interface FileExportErrorDetails extends BaseErrorDetails {
  code: FileExportErrorCode;
  uri?: string;
  fileName?: string;
}

export class FileExportError extends BaseError {
  public readonly code: FileExportErrorCode;
  public readonly uri?: string;

  constructor(details: FileExportErrorDetails) {
    super(details);
    this.code = details.code;
    this.uri = details.uri;
  }

  static create(
    code: FileExportErrorCode,
    message: string,
    options?: {
      originalError?: Error;
      uri?: string;
      fileName?: string;
      operation?: string;
    }
  ): FileExportError {
    return new FileExportError({
      code,
      message,
      originalError: options?.originalError,
      uri: options?.uri,
      fileName: options?.fileName,
      operation: options?.operation,
      timestamp: Date.now(),
    });
  }

  static invalidFileName(fileName: string, originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.INVALID_FILE_NAME,
      `Invalid file name: ${fileName}`,
      { originalError, fileName, operation: "export" }
    );
  }

  static permissionDenied(uri?: string, originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.PERMISSION_DENIED,
      "Permission denied for SAF operation",
      { originalError, uri, operation: "export" }
    );
  }

  static uriExpired(uri: string, originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.URI_EXPIRED,
      `SAF URI expired: ${uri}`,
      { originalError, uri, operation: "export" }
    );
  }

  static uriInvalid(uri: string, originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.URI_INVALID,
      `SAF URI invalid: ${uri}`,
      { originalError, uri, operation: "export" }
    );
  }

  static userCancelled(operation: string): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.USER_CANCELLED,
      `User cancelled ${operation}`,
      { operation }
    );
  }

  static providerUnavailable(originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.PROVIDER_UNAVAILABLE,
      "SAF document provider unavailable",
      { originalError, operation: "export" }
    );
  }

  static writeFailed(uri: string, message: string, originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.WRITE_FAILED,
      `Failed to write to ${uri}: ${message}`,
      { originalError, uri, operation: "write" }
    );
  }

  static readFailed(uri: string, message: string, originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.READ_FAILED,
      `Failed to read from ${uri}: ${message}`,
      { originalError, uri, operation: "read" }
    );
  }

  static folderPickFailed(message: string, originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.FOLDER_PICK_FAILED,
      `Failed to pick backup folder: ${message}`,
      { originalError, operation: "pick_folder" }
    );
  }

  static webUnsupported(operation: string): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.WEB_UNSUPPORTED,
      `${operation} not supported on web platform`,
      { operation }
    );
  }

  static unknownError(message: string, originalError?: Error): FileExportError {
    return FileExportError.create(
      FileExportErrorCode.UNKNOWN_ERROR,
      `Unknown export error: ${message}`,
      { originalError, operation: "unknown" }
    );
  }

  toJSON(): object {
    const base = super.toJSON();
    return {
      ...base,
      uri: this.uri,
    };
  }
}

export function isFileExportError(error: unknown): error is FileExportError {
  return error instanceof FileExportError;
}

export function getFileExportErrorCode(error: unknown): FileExportErrorCode | null {
  if (isFileExportError(error)) {
    return error.code;
  }
  return null;
}

export function getFileExportErrorMessage(error: unknown): string {
  if (isFileExportError(error)) {
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