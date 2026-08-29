---
type: reference
title: Dexie Schema
description: Database schema definition, tables, indexes, and version migrations for IndexedDB storage.
tags: [database, dexie, schema, indexeddb, migration]
---
# Dexie Schema

KIYO uses Dexie.js as a wrapper for IndexedDB to store vault files, accounts, templates, and settings. The schema defines the structure of the client-side database including tables, indexes, and version migrations.

## Purpose

The Dexie schema provides:
1. **Data Persistence**: Structured storage for user data (vaults, accounts, templates)
2. **Query Performance**: Indexed lookups for efficient data retrieval
3. **Schema Evolution**: Versioned migrations for safe updates
4. **Type Safety**: TypeScript interfaces for compile-time checking
5. **Offline-First**: Complete local storage without network dependency

## Database Structure

Defined in `/src/database/db.ts`:

```typescript
export const db = new Dexie("KiyoDB") as Dexie & {
  // Tables
  vaultTable: Dexie.Table<KiyoVaultData, string>; // id -> vault
  accountTable: Dexie.Table<Account, number>;     // auto-increment ID
  templateTable: Dexie.Table<Template, number>;   // auto-increment ID
  fileTable: Dexie.Table<FileRecord, string>;     // id -> file metadata
  settingsTable: Dexie.Table<AppSettings, number>; // auto-increment ID
};
```

### Tables

1. **vaultTable**: Stores encrypted vault files
   - Primary Key: `string` (vault ID)
   - Value: `KiyoVaultData` or `EncryptedKiyoVaultData`

2. **accountTable**: Stores user accounts/credentials
   - Primary Key: `number` (auto-increment)
   - Indexes: `domain`, `websiteUrl`, `tag`, `favorite`

3. **templateTable**: Stores account templates
   - Primary Key: `number` (auto-increment)
   - Indexes: `name`, `sortOrder`

4. **fileTable**: Stores encrypted file metadata
   - Primary Key: `string` (file ID)
   - Indexes: `name`, `createdAt`, `updatedAt`

5. **settingsTable**: Stores application settings
   - Primary Key: `number` (auto-increment)
   - Singleton pattern: only one row (ID = 1)

## Schema Definition

### Vault Table
```typescript
interface KiyoVaultData {
  id: string;           // Vault identifier (UUID)
  name: string;         // Vault display name
  createdAt: number;    // Timestamp
  updatedAt: number;    // Timestamp
  accounts: Account[];  // Array of accounts
  templates: Template[]; // Array of templates
  files: FileRecord[];   // Array of attached files
  settings: AppSettings; // Vault-specific settings
}

// Encrypted version stored in DB
interface EncryptedKiyoVaultData {
  version: 1;
  encrypted: true;
  salt: string;         // Base64 encoded
  iv: string;           // Base64 encoded
  ciphertext: string;   // Base64 encoded
}
```

### Account Table
```typescript
interface Account {
  id: number;               // Auto-increment
  vaultId: string;          // Foreign key to vault
  websiteUrl: string;       // Login URL
  domain: string;           // Normalized domain for autofill
  username: string;         // Email/username
  password: string;         // Encrypted password
  notes: string;            // Encrypted notes
  tag: string[];            // Array of tags
  favorite: boolean;        // Starred status
  createdAt: number;
  updatedAt: number;
  fields: AccountField[];   // Custom fields from template
}
```

### Template Table
```typescript
interface Template {
  id: number;               // Auto-increment
  vaultId: string;          // Foreign key to vault
  name: string;             // Template name
  description: string;      // Description
  icon: string;             // Emoji/icon
  sortOrder: number;        // Display order
  fields: TemplateField[];  // Field definitions
  createdAt: number;
  updatedAt: number;
}
```

### File Table
```typescript
interface FileRecord {
  id: string;               // File identifier (UUID)
  vaultId: string;          // Foreign key to vault
  name: string;             // Original filename
  mimeType: string;         // MIME type
  size: number;             // File size in bytes
  data: string;             // Base64 encoded encrypted content
  createdAt: number;
  updatedAt: number;
}
```

### Settings Table
```typescript
interface AppSettings {
  id: number;               // Always 1 (singleton)
  theme: 'light' | 'dark' | 'system';
  fontSize: number;         // Base font size (px)
  autoLockTimeout: number;  // Minutes (0 = disabled)
  biometricEnabled: boolean; // Use biometrics for unlock
  clipboardClearDelay: number; // Seconds to clear clipboard
  createdAt: number;
  updatedAt: number;
}
```

## Indexes

Each table defines indexes for query performance:

### accountTable Indexes
- `domain`: For autofill domain matching
- `websiteUrl`: For exact URL lookups
- `tag`: For tag-based filtering
- `[favorite+domain]`: Composite for favorite filtering
- `updatedAt`: For sorting by recency

### templateTable Indexes
- `name`: For template lookup by name
- `sortOrder`: For ordered display

### fileTable Indexes
- `name`: For filename search
- `createdAt`: For sorting by date
- `vaultId`: For vault-scoped queries

### settingsTable Indexes
- No additional indexes (singleton access by ID=1)

## Version Migrations

Schema changes are handled through versioned migrations:

### Version 1
- Initial schema with all tables defined above

### Version 2
- Added `domain` index to accountTable for autofill performance
- Added `favorite` field to Account interface

### Version 3
- Added `files` array to KiyoVaultData for file attachments
- Created fileTable for encrypted file storage

### Version 4
- Enhanced template system with field definitions
- Added `fields` to Account and Template interfaces

### Version 5
- Added `settingsTable` for application preferences
- Migrated UI settings from localStorage to IndexedDB

## Data Flow

### Write Path
1. **User Action**: Create/edit account/template/file
2. **Store Update**: Zustand store modifies local state
3. **Persistence Hook**: `usePersistence` middleware saves to Dexie
4. **Encryption**: Data encrypted before storage (vault level) or field level
5. **IndexedDB**: Dexie writes to IndexedDB via transaction

### Read Path
1. **Component Mount**: Subscribe to store updates
2. **Store Hydration**: On Init**: Load data from Dexie into Zustand stores
3. **Decryption**: Decrypt vault data using derived key
4. **UI Render**: Components render from store state

## Encryption Integration

### Vault-Level Encryption
- Entire vault JSON encrypted with PBKDF2-derived key
- Salt, IV, ciphertext stored in vaultTable
- Key derivation: `/src/crypto/encryption.ts#createCryptoKey`

### Field-Level Encryption (Future)
- Sensitive fields (password, notes) encrypted individually
- Allows searching/unencrypted fields while protecting secrets
- Uses same AES-GCM with vault-derived key

## Performance Considerations

### Read Optimization
- **Index Usage**: All queries leverage defined indexes
- **Pagination**: LIMIT/OFFSET for large datasets
- **Selective Fields**: Only fetch needed columns when possible

### Write Optimization
- **Batch Operations**: Multiple puts in single transaction
- **Debouncing**: Rapid updates batched before write
- **Selective Sync**: Only changed records written

### Memory Management
- **Lazy Loading**: Large vaults loaded on-demand
- **Garbage Collection**: Orphaned files cleaned via references
- **Size Limits**: Individual item size validation

## Source

- **Database Instance**: `/src/database/db.ts`
- **Schema Definition**: Inline in db.ts (Dexie schema builder)
- **Type Definitions**: 
  - `/src/models/vault.ts` (KiyoVaultData, EncryptedKiyoVaultData)
  - `/src/models/account.ts` (Account, AccountField)
  - `/src/models/template.ts` (Template, TemplateField)
  - `/src/models/file.ts` (FileRecord, FileMetadata)
  - `/src/models/settings.ts` (AppSettings)
- **Persistence Layer**: 
  - `/src/database/fileStorage.ts` (vault CRUD)
  - `/src/database/table-modules/` (individual table operations)
  - `/src/store/` (Zustand persistence middleware)
- **Encryption**: `/src/crypto/` (key derivation and AES-GCM)
- **Migrations**: Handled implicitly by Dexie version checking

## Testing

- **Unit Tests**: `/src/database/db.integration.test.ts`
- **Migration Tests**: Version upgrade/downgrade scenarios
- **Concurrency Tests**: Simultaneous read/write operations
- **Encryption Tests**: Data integrity after encrypt/decrypt cycles
- **Performance Tests**: Query timing with large datasets

## Relationships

### Foreign Keys
- `account.vaultId` → `vault.id`
- `template.vaultId` → `vault.id`
- `file.vaultId` → `vault.id`
- `settings.id` = 1 (singleton constraint)

### Cascading Deletes
When a vault is deleted:
1. All accounts with matching vaultId are deleted
2. All templates with matching vaultId are deleted
3. All files with matching vaultId are deleted
4. Settings preserved (global, not vault-specific)

### IndexedDB Specifics
- **Auto-Increment**: Dexie handles number key auto-generation
- **Compound Indexes**: Supported via array syntax `[favorite, domain]`
- **Indexed Properties**: Only top-level fields can be indexed
- **Object Stores**: Each table maps to an IndexedDB object store
- **Transactions**: All operations wrapped in Dexie transactions for ACID