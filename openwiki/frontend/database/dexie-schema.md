---
type: reference
title: Dexie Schema
description: KiyoDatabase schema v13/v14 with accounts/templates/settings/metadata/files tables, PK changes, and Dexie migrations.
tags: [database, dexie, schema, indexeddb, migration]
---

# Dexie Schema

KIYO uses Dexie.js as a wrapper for IndexedDB to store accounts, templates, app settings, file metadata, and encrypted vault files. The schema is defined in `/src/database/db.ts`.

## KiyoDatabase

```typescript
export class KiyoDatabase extends Dexie {
  accounts!: EntityTable<AccountRecord, "id">;
  templates!: EntityTable<TemplateRecord, "id">;
  settings!: Table<AppSettings, number>;
  metadata!: Table<FileMetadata, number>;
  files!: Table<FileRecord, string>;

  constructor() {
    super("kiyo-db");
    this.version(13).stores({ /* ... */ });
    this.version(14).stores({ /* ... */ });
  }
}

export const db = new KiyoDatabase();
```

## Tables

| Table | PK | Indexes | Purpose |
|-------|----|---------|---------|
| `accounts` | `++id` (auto) | `createdAt`, `updatedAt` | Encrypted account records |
| `templates` | `++id` (auto) | `createdAt`, `updatedAt` | Encrypted template records |
| `settings` | `++id` (auto) | `theme`, `lockEnabled`, `autoLockTime`, `fontSize`, `biometricEnabled` | App settings (singleton ID=1) |
| `metadata` | `id` | `version`, `createdAt` | Database metadata (singleton ID=1) |
| `files` | `id` | `fileName`, `createdAt`, `updatedAt` | Vault file records (PK = fileName since v14) |

## FileRecord Shape

```typescript
export interface FileRecord {
  id: string;        // PK = fileName since v14
  fileName: string;
  fileData: string;  // JSON string of KiyoVaultData (encrypted or plain)
  encrypted: boolean;
  salt?: string;     // base64 PBKDF2 salt (encrypted vaults only)
  createdAt: number;
  updatedAt: number;
}
```

## AccountRecord / TemplateRecord

Account and template records are produced by `recordEncryption.ts` — either `{ encryptedData: Uint8Array, iv: Uint8Array, algorithm, encrypted: true }` for encrypted vaults, or `{ encryptedData: Uint8Array (UTF-8 JSON), iv: Uint8Array (zeros), algorithm, encrypted: false }` for plaintext vaults.

## Schema Versions

### v13

```typescript
this.version(13)
  .stores({
    accounts:   "++id, createdAt, updatedAt",
    templates:  "++id, createdAt, updatedAt",
    settings:   "++id, theme, lockEnabled, autoLockTime, fontSize, biometricEnabled",
    metadata:   "id, version, createdAt",
    files:      "id, fileName, createdAt, updatedAt",
  })
  .upgrade((transaction) => {
    transaction.table("files").clear();
  });
```

The `files` table is wiped on the v12 → v13 upgrade because the PK changed from auto-increment number to out-of-line string. The vault snapshot lives in the file-system `.json` backup and is restored via the import flow. Data loss = 0.

### v14

```typescript
this.version(14)
  .stores({
    /* same shape as v13 */
    files:      "id, fileName, createdAt, updatedAt",
  })
  .upgrade(async (transaction) => {
    // v13 row 1개(id="active")를 fileName PK로 승계 — 데이터 손실 0.
    const rows = await transaction.table("files").toArray();
    for (const row of rows) {
      if (row.id === "active" && row.fileName) {
        const newId = row.fileName;
        await transaction.table("files").delete("active");
        await transaction.table("files").put({ ...row, id: newId });
      }
    }
  });
```

The v13 row whose id was the literal `"active"` is rewritten so its `id` becomes its `fileName`. The delete + put pattern avoids Dexie 4's quirk of treating PK changes as new rows.

## Database Helpers

The `db.ts` file exports top-level helpers:

```typescript
export const getDatabaseSnapshot(filename: string, cryptoKey?: CryptoKey): Promise<KiyoVaultData>
export const persistVaultSnapshot(params: SyncDatabaseParams): Promise<void>
export const replaceDatabaseData(params: ReplaceDatabaseDataParams): Promise<void>
export const initializeDatabase(): Promise<void>
```

- `getDatabaseSnapshot` — reads + decrypts all accounts/templates, returns `KiyoVaultData`. Used during auto-save and during explicit user-initiated export.
- `persistVaultSnapshot` — auto-save write path (called from `syncQueue`). Encrypts the snapshot (if `cryptoKey` present), upserts the `files` row for `activeFileName`, and may trigger `tryTriggerAutoBackup` for SAF-backed auto-backup.
- `replaceDatabaseData` — atomic clear + bulkPut for import / changePin / openImported flows. Encrypts each record outside the transaction (to keep the transaction short) and writes the resulting records in a single `db.transaction("rw", accounts, templates, metadata, files, ...)`.
- `initializeDatabase` — seeds the metadata singleton on first run.

## Encrypted vs Plaintext Records

Records support both encrypted and plaintext modes via the `encrypted: boolean` flag. Encryption is per-record (`recordEncryption.ts`), and the same `CryptoKey` (derived from PIN via PBKDF2) is used for both file-level and record-level encryption. The `files.fileData` may be plaintext JSON (`KiyoVaultData` JSON) or encrypted JSON (`EncryptedKiyoVaultData`).

## Source Anchors

- `db.ts` — `/src/database/db.ts`
- Table modules — `/src/database/accountTable.ts`, `/src/database/templateTable.ts`, `/src/database/fileTable.ts`
- Record encryption — `/src/crypto/recordEncryption.ts`
- File storage pipeline — `/src/database/fileStorage.ts`

## Tests

- `/src/database/fileStorage.lifecycle.integration.test.ts` — end-to-end create/open/import/change-pin/close flows.
- `/src/database/fileStorage.encryption.integration.test.ts` — round-trip encryption behavior.
- `/src/database/fileTable.integration.test.ts` — fileTable CRUD including multi-vault.
- `/src/database/accountTable.integration.test.ts`, `templateTable.integration.test.ts` — record CRUD with cryptoKey.