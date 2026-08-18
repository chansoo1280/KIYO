---
type: overview
title: Error Handling Overview
description: Overview of error handling strategy and the FileStorageError class in KIYO.
tags: [errors, error-handling, FileStorageError]
---

# Error Handling Overview

KIYO uses a centralized error handling mechanism for file storage operations, primarily through the `FileStorageError` class. This ensures consistent error reporting and handling across the application, especially for operations involving encryption, decryption, file I/O, and database interactions.

## Error Handling Strategy

### Centralized Error Class
- All file storage-related errors are instances of `FileStorageError` or extend it.
- The error class includes a code, message, and optional metadata (original error, file name, operation, timestamp).
- This allows for precise error identification and handling in the UI and services.

### Error Propagation
- Errors are thrown from low-level utilities (crypto, file storage) and caught at appropriate layers (stores, components).
- The UI layer catches these errors to display user-friendly messages and handle recovery (e.g., prompting for PIN retry).

### Error Codes
- A comprehensive set of error codes is defined in `FileStorageErrorCode` enum, covering:
  - File operations (not found, read/write/delete errors)
  - Encryption/decryption failures
  - PIN and validation errors
  - Storage and permission issues
  - Database errors
  - Data format and corruption errors

### Usage in Layers
- **Crypto Utilities**: Throw `FileStorageError` with codes like `ENCRYPTION_ERROR`, `DECRYPTION_ERROR`, `INVALID_PIN`.
- **File Storage (`src/database/fileStorage.ts`)**: Uses `FileStorageError` for file I/O and encryption-related errors.
- **Database Tables**: May throw `FileStorageError` with `DATABASE_ERROR` or related codes for query failures.
- **Stores**: Catch errors from crypto/file storage and may re-throw or handle them (e.g., showing error dialogs).
- **Components**: Use try/catch to handle errors from stores and display appropriate UI feedback.

## Benefits
- **Consistency**: All file storage errors follow the same structure.
- **Debuggability**: Error codes and metadata (like file name and operation) aid in debugging.
- **User Experience**: Enables mapping error codes to specific user messages (e.g., "Invalid PIN" -> prompt to re-enter PIN).
- **Maintainability**: Centralized error definitions make it easy to add new error types or modify existing ones.

---