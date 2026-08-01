# Plan: Account-Level Encryption in IndexedDB (No Migration)

## Goal
Replace field-level encryption with whole-account encryption. Each account stored as single AES-GCM encrypted blob. Templates also encrypted. No migration - clear tables on version bump.

## Current Architecture
- `accounts` table: stores full `Account` objects with `fields[]` array
- `templates` table: stores `Template` objects plaintext
- `fieldEncryption.ts`: encrypts/decrypts individual sensitive fields
- `accountTable.saveAll()`: calls `encryptAccountsSensitiveFields()` before `bulkPut()`

## Target Architecture

### AccountRecord
```typescript
interface AccountRecord {
  id: number;                    // primary key (auto-increment)
  version: 1;                    // encryption format version
  algorithm: "AES-GCM";          // algorithm identifier
  encryptedData: Uint8Array;     // AES-GCM ciphertext of entire Account object
  iv: Uint8Array;                // 12-byte IV
  createdAt: number;
  updatedAt: number;
}
```

### TemplateRecord
```typescript
interface TemplateRecord {
  id: string;                    // UUID or string ID
  version: 1;
  algorithm: "AES-GCM";
  encryptedData: Uint8Array;     // AES-GCM ciphertext of entire Template object
  iv: Uint8Array;
  createdAt: number;
  updatedAt: number;
}
```

## Implementation Steps

### 1. Database Schema Migration (db.ts)
- Bump version to **11** → **Implemented as v12**
- Upgrade transaction: `accounts.clear()`, `templates.clear()`
- New stores:
  ```typescript
  accountRecords: "++id, createdAt, updatedAt",
  templateRecords: "id, createdAt, updatedAt",
  ```
- Drop old `accounts`, `templates` stores → **Kept same store names (`accounts`, `templates`) but with new schema**

### 2. New Crypto Utility (crypto/accountEncryption.ts) → **Implemented as `src/crypto/recordEncryption.ts`**
- `encryptRecord<T>(data: T, key: CryptoKey): Promise<{ encryptedData: Uint8Array; iv: Uint8Array }>`
- `decryptRecord<T>(encryptedData: Uint8Array, iv: Uint8Array, key: CryptoKey): Promise<T>`
- Generic, works for both Account and Template
- Reuse AES-GCM logic from `encryption.ts`
- **Additional: `createEncryptedRecord`, `updateEncryptedRecord`, `isEncryptedRecord` helpers**

### 3. Update accountTable.ts → accountRecordTable.ts (or keep name) → **Kept as `accountTable.ts`**
- `getAll(cryptoKey?)`: fetch all → decrypt each → return `Account[]`
- `getById(id, cryptoKey?)`: fetch one → decrypt → return `Account`
- `create(account)`: encrypt → insert → return decrypted `Account` with new ID
- `update(account)`: encrypt → put record
- `delete(id)`: delete by id
- **Remove** `saveAll()` entirely ✅
- **Remove** `encryptAccountsSensitiveFields` / `decryptAccountsSensitiveFields` imports ✅
- **Additional: `restore`, `bulkRestore`, `initializeDevData`, `clear` methods**

### 4. New templateRecordTable.ts (similar pattern) → **Implemented as `templateTable.ts`**
- `getAll(cryptoKey?)`: fetch all → decrypt → `Template[]`
- `getById(id, cryptoKey?)`: fetch one → decrypt → `Template`
- `create(template)`: encrypt → insert
- `update(template)`: encrypt → put
- `delete(id)`: delete by id
- `saveAll()` removed ✅
- **Additional: `reorder`, `restore`, `bulkRestore`, `initializeDevData`, `clear` methods**

### 5. Update accountStore.ts
- `initialize()`: call `accountRecordTable.getAll(cryptoKey)` → **`accountTable.getAll(cryptoKey)`**
- `addAccount()`: call `accountRecordTable.create()` → sync → **`accountTable.create()`**
- `updateAccount()`: call `accountRecordTable.update()` → sync → **`accountTable.update()`**
- `deleteAccount()`: unchanged ✅
- **Remove** all `saveAll()` calls after mutations ✅

### 6. Update template store (if exists) or Settings.tsx usage
- Find where templates are read/written → **Found `templateStore.ts`**
- Replace with `templateRecordTable` calls with cryptoKey → **Updated to use `templateTable`**

### 7. Autofill Sync Impact
- `syncToAutofill()` reads from store (decrypted accounts in memory) → no change ✅

### 8. File Backup/Restore (fileStorage.ts, db.ts)
- `getDatabaseSnapshot()`: returns decrypted accounts/templates from stores → no change ✅
- `syncDatabaseToFile()`: encrypts whole `KiyoDataFile` → no change ✅
- `replaceDatabaseData()`: inserts via `accountRecordTable.create()` / `templateRecordTable.create()` → encrypts automatically → **Uses `accountTable.bulkRestore` / `templateTable.bulkRestore`**

### 9. Testing
- Unit tests for `accountEncryption.ts` encrypt/decrypt roundtrip (Account, Template) → **Implemented in `recordEncryption.test.ts`**
- Integration tests: CRUD with cryptoKey for both tables ✅
- Test version bump clears data correctly ✅

## Files to Modify/Create

| File | Plan Action | Actual Implementation |
|------|-------------|----------------------|
| `src/database/db.ts` | Version 11, new stores, clear old tables | **Version 12**, same store names with new schema, clear in upgrade |
| `src/crypto/accountEncryption.ts` | **New** - generic record encryption | **Created as `src/crypto/recordEncryption.ts`** |
| `src/crypto/accountEncryption.test.ts` | **New** - unit tests | **Created as `src/crypto/recordEncryption.test.ts`** |
| `src/database/accountTable.ts` | Rewrite for AccountRecord | **Rewritten with encrypted record pattern** |
| `src/database/templateRecordTable.ts` | **New** - for TemplateRecord | **Created as `src/database/templateTable.ts`** |
| `src/store/accountStore.ts` | Remove saveAll calls | **Removed saveAll calls** |
| Template usage files | Update to use templateRecordTable | **Updated `templateStore.ts`** |
| `src/database/accountTable.test.ts` | Update tests | **Updated** |
| `src/database/templateRecordTable.test.ts` | **New** - integration tests | **Created as `src/database/templateTable.test.ts`** |

## Order of Execution
1. Create `accountEncryption.ts` with tests → **Created `recordEncryption.ts` with tests**
2. Create `templateRecordTable.ts` with tests → **Created `templateTable.ts` with tests**
3. Update `accountTable.ts` to use new encryption ✅
4. Update `db.ts` schema v11 + clear upgrade → **v12 with clear upgrade**
5. Update `accountStore.ts` ✅
6. Update template-related code (find usages) → **Updated `templateStore.ts`**
7. Run `npm run check` - fix type errors ✅
8. Test fresh install (no migration needed) ✅

## Notes
- **No migration** = simpler, but users lose data on upgrade (acceptable for pre-release)
- Uint8Array in IndexedDB: Dexie supports ArrayBuffer/Uint8Array natively
- Templates encrypted same as accounts - consistent approach
- Encryption version/algorithm fields allow future algorithm changes

## Key Differences: Plan vs Implementation

| Aspect | Plan | Implementation |
|--------|------|----------------|
| Crypto utility filename | `accountEncryption.ts` | **`recordEncryption.ts`** (generic name) |
| DB version | 11 | **12** |
| Store names | `accountRecords`, `templateRecords` | **`accounts`, `templates`** (same names, new schema) |
| Template table filename | `templateRecordTable.ts` | **`templateTable.ts`** |
| CryptoKey param | Required in all methods | **Optional** (fallback to plaintext for unencrypted files) |
| Additional methods | Basic CRUD | **+ `restore`, `bulkRestore`, `initializeDevData`, `clear`, `reorder` (templates)** |
| `recordEncryption.ts` exports | `encryptRecord`, `decryptRecord` | **+ `createEncryptedRecord`, `updateEncryptedRecord`, `isEncryptedRecord`, `EncryptedRecord` interface** |