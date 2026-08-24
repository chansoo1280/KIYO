---
type: detail
title: FileStorageError Class
description: Detailed documentation of the FileStorageError class, its error codes, and usage in KIYO.
tags: [error, FileStorageError, error-handling]
---

# FileStorageError Class

The `FileStorageError` class is a custom error class used throughout KIYO for handling errors related to file storage operations, including encryption, decryption, file I/O, and database interactions. It provides a structured way to represent errors with codes, messages, and contextual metadata.

## Source File
- `/src/errors/FileStorageError.ts`

## Class Definition

```typescript
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

  // Static factory methods for creating specific error instances
  static create(...): FileStorageError { ... }
  static fileNotFound(...): FileStorageError { ... }
  // ... (other static methods)
}
```

## Type Definitions

### FileStorageErrorCode

An enum-like object defining all possible error codes:

```typescript
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
```

### FileStorageErrorDetails

Interface for the details object passed to the constructor:

```typescript
export interface FileStorageErrorDetails {
  code: FileStorageErrorCode;
  message: string;
  originalError?: Error;
  fileName?: string;
  operation?: string;
  timestamp: number;
}
```

## Static Factory Methods

The class provides static methods to create common error instances:

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `create` | `code`, `message`, `options?` | `FileStorageError` | Generic factory method |
| `fileNotFound` | `fileName`, `originalError?` | `FileStorageError` | Error when a file is not found |
| `fileReadError` | `fileName`, `originalError?` | `FileStorageError` | Error when reading a file fails |
| `fileWriteError` | `fileName`, `originalError?` | `FileStorageError` | Error when writing a file fails |
| `fileDeleteError` | `fileName`, `originalError?` | `FileStorageError` | Error when deleting a file fails |
| `fileAlreadyExists` | `fileName` | `FileStorageError` | Error when trying to create a file that already exists |
| `invalidFileFormat` | `fileName`, `originalError?` | `FileStorageError` | Error when the file format is invalid |
| `encryptionError` | `message`, `originalError?` | `FileStorageError` | Error during encryption |
| `decryptionError` | `message`, `originalError?` | `FileStorageError` | Error during decryption |
| `invalidPin` | `originalError?` | `FileStorageError` | Error when PIN is invalid |
| `invalidSalt` | `originalError?` | `FileStorageError` | Error when salt is invalid |
| `invalidKey` | `originalError?` | `FileStorageError` | Error when encryption key is invalid |
| `storageUnavailable` | `originalError?` | `FileStorageError` | Error when storage is not available |
| `permissionDenied` | `operation`, `originalError?` | `FileStorageError` | Error when permission is denied for an operation |
| `databaseError` | `message`, `originalError?` | `FileStorageError` | Error related to database operations |
| `invalidDataFormat` | `message`, `originalError?` | `FileStorageError` | Error when data format is invalid |
| `fileCorrupted` | `fileName`, `originalError?` | `FileStorageError` | Error when a file is corrupted |
| `pinMismatch` | `originalError?` | `FileStorageError` | Error when PIN does not match |
| `saltMismatch` | `originalError?` | `FileStorageError` | Error when salt does not match |
| `keyDerivationFailed` | `originalError?` | `FileStorageError` | Error when key derivation fails |
| `encryptionFailed` | `originalError?` | `FileStorageError` | Generic encryption failure |
| `decryptionFailed` | `originalError?` | `FileStorageError` | Generic decryption failure |
| `fileWriteFailed` | `fileName`, `originalError?` | `FileStorageError` | Error when file write fails |
| `fileReadFailed` | `fileName`, `originalError?` | `FileStorageError` | Error when file read fails |
| `databaseConnectionFailed` | `originalError?` | `FileStorageError` | Error when database connection fails |
| `databaseQueryFailed` | `query`, `originalError?` | `FileStorageError` | Error when a database query fails |
| `invalidFileName` | `fileName` | `FileStorageError` | Error when the file name is invalid |
| `fileTooLarge` | `fileName`, `size`, `maxSize` | `FileStorageError` | Error when the file exceeds the maximum allowed size |
| `storageQuotaExceeded` | `originalError?` | `FileStorageError` | Error when storage quota is exceeded |

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | string | Error message (inherited from Error) |
| `name` | string | Always set to "FileStorageError" |
| `code` | FileStorageErrorCode | The error code identifying the type of error |
| `originalError` | Error (optional) | The original error that caused this error, if any |
| `fileName` | string (optional) | The name of the file related to the error, if applicable |
| `operation` | string (optional) | The operation being performed when the error occurred (e.g., "read", "write", "encrypt") |
| `timestamp` | number | Timestamp (milliseconds since epoch) when the error was created |

## Usage Examples

### Throwing a FileStorageError

```typescript
import { FileStorageError } from "@/errors/FileStorageError";

if (!fileExists) {
  throw FileStorageError.fileNotFound("myvault.kiyo");
}
```

### Catching and Handling a FileStorageError

```typescript
try {
  const accounts = await vaultService.importVault(file, pin);
} catch (error) {
  if (error instanceof FileStorageError) {
    switch (error.code) {
      case FileStorageErrorCode.INVALID_PIN:
        showErrorDialog("Invalid PIN. Please try again.");
        break;
      case FileStorageErrorCode.FILE_NOT_FOUND:
        showErrorDialog("The selected file was not found.");
        break;
      case FileStorageErrorCode.FILE_CORRUPTED:
        showErrorDialog("The vault file is corrupted or has been tampered with.");
        break;
      default:
        showErrorDialog(`An error occurred: ${error.message}`);
    }
  } else {
    // Handle unexpected errors
    showErrorDialog("An unexpected error occurred.");
  }
}
```

## Error Code Categories

The error codes can be grouped into the following categories:

### File Operations
- `FILE_NOT_FOUND`
- `FILE_READ_ERROR`, `FILE_READ_FAILED`
- `FILE_WRITE_ERROR`, `FILE_WRITE_FAILED`, `WRITE_FAILED`
- `FILE_DELETE_ERROR`
- `FILE_ALREADY_EXISTS`
- `INVALID_FILE_NAME`
- `FILE_TOO_LARGE`

### Encryption/Decryption
- `ENCRYPTION_ERROR`, `ENCRYPTION_FAILED`
- `DECRYPTION_ERROR`, `DECRYPTION_FAILED`
- `INVALID_PIN`
- `INVALID_SALT`
- `INVALID_KEY`
- `KEY_DERIVATION_FAILED`
- `PIN_MISMATCH`
- `SALT_MISMATCH`

### Data and Format
- `INVALID_FILE_FORMAT`
- `INVALID_JSON`
- `INVALID_FORMAT`
- `INVALID_DATA_FORMAT`
- `FILE_CORRUPTED`

### Storage and Permissions
- `STORAGE_UNAVAILABLE`
- `PERMISSION_DENIED`
- `STORAGE_QUOTA_EXCEEDED`

### Database
- `DATABASE_ERROR`
- `DATABASE_CONNECTION_FAILED`
- `DATABASE_QUERY_FAILED`

### Unknown
- `UNKNOWN_ERROR`

## Integration with Layers

### Crypto Utilities (`/src/crypto/`)
- Encryption and decryption functions throw `FileStorageError` with codes like `ENCRYPTION_ERROR`, `DECRYPTION_ERROR`, `INVALID_PIN` when operations fail or invalid inputs are provided.

### File Storage (`/src/database/fileStorage.ts`)
- Reads and writes encrypted vault files, throwing `FileStorageError` for file I/O errors, encryption/decryption failures, and validation issues.

### Database Tables (`/src/database/*.ts`)
- May throw `FileStorageError` with `DATABASE_ERROR` or related codes for query or connection failures.

### Zustand Stores
- Catch errors from crypto/file storage/database and may re-throw them or convert to user-friendly messages.

### UI Components
- Use try/catch to handle errors from stores and display appropriate feedback (e.g., error dialogs, toast messages).

## Best Practices

- Always use the static factory methods to create `FileStorageError` instances to ensure consistency.
- Provide as much context as possible (fileName, operation, originalError) when creating an error.
- Catch `FileStorageError` specifically to handle known error conditions, and let unexpected errors propagate or be caught by a general error handler.
- Do not expose internal error details (like stack traces) to the end user; map error codes to user-friendly messages.
- When wrapping errors from other libraries (e.g., IndexedDB, crypto.subtle), pass the original error as the `originalError` option to preserve the root cause.

---