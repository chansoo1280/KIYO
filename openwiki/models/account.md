---
type: model
title: Account Model
description: Represents a single password/account entry with fields for username, password, notes, and custom fields defined by templates.
tags: [model, account, data-structure]
---

# Account Model

The Account model represents a single password/account entry in KIYO. It includes standard fields (username, password, notes) and custom fields defined by templates, along with metadata for organization and security.

## Source File
- `/src/models/account.ts`

## TypeScript Interface

```typescript
export interface Account {
  id: string;
  name: string; // Account name or title (e.g., "Gmail", "Netflix")
  username: string;
  password: string;
  notes?: string;
  fields: CustomField[]; // Custom fields defined by the account's template
  templateId: string; // Reference to the template used for this account
  createdAt: number; // Timestamp (milliseconds since epoch)
  updatedAt: number; // Timestamp (milliseconds since epoch)
  favorite: boolean; // Whether the account is marked as favorite
  tags: string[]; // User-defined tags for categorization
}
```

### CustomField Type

```typescript
export interface CustomField {
  id: string; // Unique identifier for the field (from template)
  value: string; // User-entered value for this field
}
```

## Properties Explained

| Property | Type | Description |
|---------|------|-------------|
| `id` | string | Unique identifier for the account (UUID) |
| `name` | string | Display name/title of the account |
| `username` | string | Username or email associated with the account |
| `password` | string | Password for the account (encrypted at rest) |
| `notes` | string (optional) | Additional notes about the account |
| `fields` | CustomField[] | Array of custom fields defined by the template |
| `templateId` | string | ID of the template that defines this account's structure |
| `createdAt` | number | Timestamp when account was created |
| `updatedAt` | number | Timestamp when account was last modified |
| `favorite` | boolean | Flag indicating if account is favorited |
| `tags` | string[] | Array of user-defined tags for organization |

## Usage Across Layers

### Frontend Components
- **AccountList**: Displays accounts in a list, showing name, username, and favorite status
- **AccountDetail**: Shows all account fields including custom fields from template
- **AccountEdit/Form**: Uses template to render appropriate input fields for editing
- **Templates**: When creating accounts from templates, uses templateId to determine field structure

### Zustand Stores
- **accountStore**: 
  - Loads/saves accounts to/from IndexedDB
  - Handles encryption/decryption of sensitive fields (password, custom field values)
  - Provides CRUD operations (add, update, delete, favorite, tag)
  - Supports filtering/searching by name, username, tags, favorites

### Database Layer
- **accountTable** (`src/database/accountTable.ts`):
  - Dexie.js table typed to Account interface
  - Indexes on `templateId`, `favorite`, `updatedAt` for efficient queries
  - Automatic encryption/decryption of sensitive fields via middleware

### Cryptographic Operations
- Sensitive fields (`password`, `fields[].value`) are encrypted using:
  - PBKDF2 key derivation from user PIN
  - AES-GCM encryption with random IV
  - Encryption/decryption handled automatically by store/database layer
- Non-sensitive fields (`id`, `name`, `username`, `notes`, `templateId`, timestamps, `favorite`, `tags`) are stored in plaintext

## Relationships

### Template Relationship
- Each Account references exactly one Template via `templateId`
- Template defines which `CustomField` objects an Account can have
- When template changes, existing accounts retain their original template reference

### Vault Relationship
- Accounts can be exported to/imported from encrypted Vault files
- During export, Accounts are encrypted with vault-specific key
- During import, Accounts are decrypted and added to current database

### WebsitePreset Relationship
- Used for autofill matching: WebsitePreset defines patterns that match Account
- Matching based on:
  - Account.username matching email patterns in WebsitePreset
  - Or custom logic in AutofillService for domain/package matching

## Validation Rules

### Required Fields
- `id`: Must be non-empty string (UUID)
- `name`: Must be non-empty string (max 100 chars)
- `username`: Must be non-empty string
- `password`: Must be non-empty string
- `templateId`: Must reference existing template
- `createdAt`, `updatedAt`: Must be valid timestamps
- `favorite`: Must be boolean
- `tags`: Must be array of strings

### Field Validation
- `name`: Max length 100 characters
- `username`: Valid email format or non-empty string
- `password`: Min length 6 characters (configurable)
- `notes`: Max length 500 characters
- `fields[].id`: Must match field ID from template
- `fields[].value`: Validation depends on template field type

## Example Account

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Gmail",
  "username": "user@gmail.com",
  "password": "encrypted_value_here",
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
```

## Security Considerations

- **Encryption at Rest**: Sensitive fields (`password`, `custom field values`) are encrypted before storage
- **In-Memory Protection**: Decrypted values exist only in memory during active sessions
- **Auto-Lock**: Session clearing removes decrypted sensitive data from memory
- **No Plaintext Storage**: Sensitive data never written to disk in unencrypted form
- **Access Control**: Frontend components only decrypt data when needed for display/edit