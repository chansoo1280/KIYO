---
type: model
title: Vault Model
description: Represents an encrypted container (file) that stores multiple accounts, used for importing/exporting data.
tags: [model, vault, data-structure]
---

# Vault Model

The Vault model represents an encrypted container (file) that stores multiple accounts, used for importing and exporting data. Vaults are encrypted with a user-provided PIN and can be saved to or loaded from the device's file system.

## Source File
- `/src/models/vault.ts`

## TypeScript Interface

```typescript
export interface Vault {
  id: string;
  name: string;
  accounts: Account[]; // Array of accounts stored in the vault
  createdAt: number; // Timestamp when the vault was created
  updatedAt: number; // Timestamp when the vault was last modified
}
```

### Note: The `Account` type is imported from `/src/models/account.ts`.

## Properties Explained

| Property | Type | Description |
|---------|------|-------------|
| `id` | string | Unique identifier for the vault (UUID) |
| `name` | string | Human-readable name of the vault (e.g., "Personal", "Work") |
| `accounts` | Account[] | Array of account objects stored in the vault |
| `createdAt` | number | Timestamp (milliseconds since epoch) when the vault was created |
| `updatedAt` | number | Timestamp (milliseconds since epoch) when the vault was last modified |

## Usage Across Layers

### Frontend Components
- **FileOpenDialog**: Allows user to select a vault file to import; reads and decrypts the file, then adds accounts to the database.
- **FileCreateDialog**: Allows user to create a new vault by selecting accounts to export; encrypts the accounts and saves to a file.
- **Accounts Page**: Import/Export buttons trigger the file dialogs.

### Zustand Stores
- **accountStore**: 
  - Provides `exportAccounts` function that takes an array of accounts and returns encrypted vault data.
  - Provides `importAccounts` function that takes decrypted vault data and adds accounts to the store.
- The actual encryption/decryption is handled by crypto utilities.

### Database Layer
- No direct table for vaults; vaults are files stored in the app's private directory.
- The `fileStorage` module (`src/database/fileStorage.ts`) handles reading/writing vault files and encryption/decryption.

### Cryptographic Operations
- Vault encryption/decryption uses:
  - PBKDF2 to derive encryption key from user PIN
  - AES-GCM to encrypt/decrypt the vault data (JSON string of accounts)
  - Random IV for each encryption operation
  - Authentication tag to ensure data integrity

### File Storage
- Vault files are stored as `.kiyo` files in the app's private documents directory.
- File format: 
  - First 12 bytes: IV (for AES-GCM)
  - Next 16 bytes: Authentication tag
  - Remaining bytes: Encrypted data (JSON string of accounts)

## Validation Rules

### Vault Validation
- `id`: Must be non-empty string (UUID)
- `name`: Must be non-empty string (max 100 chars)
- `accounts`: Must be an array (can be empty)
- Each account in `accounts` must be a valid Account object (see account model)
- `createdAt`, `updatedAt`: Must be valid timestamps

### Example Validation Errors
- Duplicate account IDs within a vault (though not strictly enforced, as IDs are UUIDs)
- Invalid account structure (missing required fields)
- Name exceeding 100 characters

## Relationships

### Account Relationship
- A Vault contains zero or more Account objects.
- When importing a vault, each account is added to the database as a new account (with new ID if ID collision?).
  - Note: The current implementation does not change account IDs on import; it uses the IDs from the vault.
  - If an account with the same ID already exists, it may be overwritten (depends on store implementation).

### File Storage Relationship
- Vaults are persisted as files via the fileStorage module.
- The fileStorage module handles:
  - Writing: encrypt accounts -> save to file
  - Reading: load file -> decrypt -> return accounts

## Example Vault

```json
{
  "id": "8a3f8c0e-1b2d-4f3a-9c8e-1a2b3c4d5e6f",
  "name": "Personal Vault",
  "accounts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Gmail",
      "username": "user@gmail.com",
      "password": "encrypted_password_value",
      "notes": "Work email account",
      "fields": [
        {
          "id": "recovery-email",
          "value": "recovery@example.com"
        }
      ],
      "templateId": "email-template",
      "createdAt": 1640995200000,
      "updatedAt": 1640995200000,
      "favorite": true,
      "tags": ["work", "email", "google"]
    }
  ],
  "createdAt": 1640995200000,
  "updatedAt": 1640995200000
}
```

## Security Considerations

- **Encryption at Rest**: Vault files are encrypted using PBKDF2+AES-GCM; cannot be read without the PIN.
- **Integrity Check**: AES-GCM provides authentication; tampering with the file will be detected.
- **In-Memory Protection**: Decrypted accounts exist only in memory during import/export operations.
- **No Plaintext Storage**: Vault files are always stored encrypted.
- **PIN Protection**: The encryption key is derived from the PIN; weak PINs are vulnerable to brute force (mitigated by high iteration count in PBKDF2).
- **File Permissions**: Vault files are stored in app-private directory, inaccessible to other apps.

## Import/Export Flow

### Export
1. User selects accounts to export (or all accounts).
2. `accountStore.exporter` is called with the selected accounts.
3. Crypto utility derives encryption key from user-provided PIN.
4. Accounts are converted to JSON string, encrypted with random IV.
5. IV + tag + encrypted data are written to a `.kiyo` file in the documents directory.
6. User is prompted to save or share the file.

### Import
1. User selects a `.kiyo` file via file picker.
2. File is read as ArrayBuffer.
3. Crypto utility derives encryption key from user-provided PIN (same as used to encrypt).
4. Attempt to decrypt: IV and tag are extracted, then AES-GCM decryption.
5. If decryption fails (wrong PIN or corrupted file), error is shown.
6. If successful, decrypted JSON is parsed into array of accounts.
7. Accounts are added to the database via `accountStore.importer`.

---