---
type: overview
title: File Storage (Vault Lifecycle)
description: Vault file CRUD operations, encryption pipeline (PBKDF2 + AES-GCM), multi-vault model with fileName PK, devAccounts seeding, and Documents-directory export.
tags: [database, file-storage, encryption, crud, import-export, multi-vault]
---

# File Storage

`/src/database/fileStorage.ts` is the central vault-lifecycle pipeline. It owns create/open/import/change-pin/close/lock operations and the Documents-directory export.

## Pages

- [File Storage](file-storage.md) — this file (vault lifecycle, Documents export).
- [File Export (SAF)](file-export.md) — SAF / auto-backup file operations.
- [Sync Queue](sync-queue.md) — auto-save queue.

## Pipeline Functions

The file is structured as a sequence of named pipeline functions, called in order from the higher-level lifecycle functions.

| # | Function | Purpose |
|---|----------|---------|
| 1 | `createEncryptedVault(vaultData, pin)` | PBKDF2 + AES-GCM encrypts the initial vault snapshot. Returns `{encryptedVaultData, cryptoKey, salt}`. |
| 1.5 | `decryptVaultData(encryptedData, pin, salt)` | Recreates `cryptoKey` from PIN+salt, decrypts. Maps crypto failure to `PIN_MISMATCH`. |
| 2 | `persistVaultRecord(fileName, vaultData)` | `fileTable.upsertFileRecord(fileName, vaultData)`. |
| 3 | `setupVaultSession({fileName, cryptoKey?, salt?})` | Sets `sessionStore.activeFileName` + `cryptoKey` + `salt`. |
| 3.5 | `initializeStores()` | Resets `accountStore.initialized` + `templateStore.initialized` to false, then reloads from the freshly-decrypted `files` row. The reset defeats the store-side guard that would otherwise preserve stale data across vault swaps. |
| 4 | `syncToAutofill()` | One-shot React → Native account sync via `KiyoAutofill.syncAccountsFromReact` (no-op on web). |
| 5 | `exportDataFile(data, fileName)` | Documents-directory full export (Android: `@capacitor/filesystem`; web: blob download). |
| 6 | `exportBackupFile(...)` (re-exported from `fileExport.ts`) | SAF user-pick save. |

## Lifecycle Functions

### createDataFile

```typescript
export const createDataFile = async (
  name: string,
  pin?: string,
  initialVault?: KiyoVaultData,
): Promise<KiyoVaultData> => {
  // 1. Resolve fileName with (N) suffix dedup
  const fileName = await fileTable.resolveFileName(normalizeDataFileName(name));
  // 2. Build initial vaultData (defaults: devAccounts + BUILTIN_TEMPLATES)
  // 3. createEncryptedVault (if pin) or plaintext
  // 4. persistVaultRecord
  // 5. setupVaultSession
  // 6. initializeStores
  // 7. syncToAutofill
  // 8. exportDataFile (Documents)
}
```

### unlockFile

```typescript
export const unlockFile = async (fileName: string, pin: string): Promise<KiyoVaultData> => {
  const fileInfo = await fileTable.getActiveFileInfo(fileName);
  // branch: encrypted → decryptVaultData → setupVaultSession (with cryptoKey+salt)
  // branch: plaintext → setupVaultSession (no cryptoKey/salt)
  // initializeStores → navigate("/accounts")
}
```

### openImportedDataFile

```typescript
export const openImportedDataFile = async (
  json: string, pin: string, fileName: string
): Promise<KiyoVaultData> => {
  // parseFileData → salt length validation (8-byte minimum)
  // branch: encrypted → verifyPin + decryptVaultData
  // branch: plaintext → parseFileData
  // replaceDatabaseData (full transactional rewrite)
  // setupVaultSession
  // initializeStores
}
```

### lockDataFile / closeDataFile

```typescript
export const lockDataFile = async (): Promise<void> => {
  useSessionStore.getState().clearCryptoKey();  // cryptoKey → null, redirect to /auth
}

export const closeDataFile = async (): Promise<void> => {
  // Clear activeFileName, cryptoKey, salt
  // Reset stores (accounts=[], templates=[], initialized=false)
  // Redirect to / (Home)
}
```

### changePin

```typescript
export const changePin = async (currentPin: string, newPin: string): Promise<void> => {
  // 1. Read current fileInfo
  // 2. decryptVaultData(currentPin, salt) → old cryptoKey
  // 3. createEncryptedVault(decryptedData, newPin) → new cryptoKey + new salt
  // 4. replaceDatabaseData (atomic rewrite with new salt)
  // 5. setupVaultSession (new cryptoKey + new salt)
}
```

### backupDataFile

```typescript
export const backupDataFile = async (): Promise<void> => {
  // Snapshot + encrypt
  // exportBackupFile → SAF user-pick
}
```

## Encryption Format

### Encrypted file blob

```json
{
  "version": 1,
  "encrypted": true,
  "salt": "<base64 16-byte salt>",
  "iv": "<base64 12-byte IV>",
  "ciphertext": "<base64 ciphertext + 16-byte GCM tag>"
}
```

### Plaintext file blob

```json
{
  "version": 1,
  "fileName": "kiyo-data.json",
  "updatedAt": 1234567890,
  "accounts": [...],
  "templates": [...],
  "metadata": [...]
}
```

## Multi-Vault Model

Since schema v14, the `files` table PK is the fileName itself. `fileTable.resolveFileName(name)` ensures that importing `kiyo.json` twice produces `kiyo.json` and `kiyo (1).json`.

## devAccounts Seeding

```typescript
import { devAccounts } from "@/data/devAccounts";
// ...
const initialAccounts: Account[] = devAccounts;
```

`devAccounts` (from `/src/data/devAccounts.ts`) is a seed dataset that is loaded into newly created vaults so the React UI has demo content for screenshots and demos. Real users would replace these with their actual accounts via the `AccountEdit` page.

## Source Anchors

- `fileStorage.ts` — `/src/database/fileStorage.ts`
- Helpers — `/src/database/fileTable.ts`, `/src/database/db.ts`
- Crypto — `/src/crypto/encryption.ts`, `/src/crypto/recordEncryption.ts`
- Seeds — `/src/data/devAccounts.ts`, `/src/data/builtinTemplates.ts`
- Export — `/src/database/fileExport.ts`

## Tests

- `/src/database/fileStorage.test.ts` — unit-level helpers.
- `/src/database/fileStorage.lifecycle.integration.test.ts` — full lifecycle.
- `/src/database/fileStorage.encryption.integration.test.ts` — round-trip encryption.
- `/src/database/fileStorage.changePin.integration.test.ts` — change-pin flow.
- `/src/database/fileStorage.error.integration.test.ts` — error mapping (PIN_MISMATCH, INVALID_FORMAT, etc.).