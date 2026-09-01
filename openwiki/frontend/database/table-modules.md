---
type: overview
title: Table Modules
description: accountTable, templateTable, fileTable CRUD + syncQueue that serializes auto-save writes and provides test/debug helpers.
tags: [database, table-module, crud, sync-queue]
---

# Table Modules

Individual table CRUD modules in `/src/database/` plus the `syncQueue` that serializes auto-save writes across the React side.

## Pages

- This file (table-modules.md) covers the shared contract.
- [Sync Queue](sync-queue.md) — the auto-save queue contract (serialize, coalesce, drain).

## accountTable

`/src/database/accountTable.ts` — CRUD over `db.accounts`.

### API

```typescript
export const accountTable = {
  async getAll(cryptoKey?: CryptoKey): Promise<Account[]>,
  async getById(id: number, cryptoKey?: CryptoKey): Promise<Account | undefined>,
  async create(account: Account, cryptoKey?: CryptoKey): Promise<Account>,
  async update(account: Account, cryptoKey?: CryptoKey): Promise<void>,
  async delete(id: number): Promise<void>,
  async clear(): Promise<void>,
};
```

### Decryption

Every read with a `cryptoKey` argument calls `decryptRecord(record, cryptoKey)` (`recordEncryption.ts`) and returns the plaintext `Account`. Writes use `createEncryptedRecord(...)` for encrypted vaults and `createPlaintextRecord(...)` for plaintext vaults. Without a `cryptoKey`, records are stored/read as plaintext JSON UTF-8 in `encryptedData` with `iv = new Uint8Array(12)`.

### Caller

`accountStore.addAccount/updateAccount/deleteAccount/loadAccounts` are the only callers. Each CRUD operation calls `enqueuePersistVaultSnapshot` after the table mutation.

## templateTable

`/src/database/templateTable.ts` — same shape as `accountTable` but operates on `Template` records. Used by `templateStore`.

## fileTable

`/src/database/fileTable.ts` — CRUD over `db.files` with the multi-vault model.

### API

```typescript
export const fileTable = {
  async upsertFileRecord(fileName: string, vaultData: KiyoVaultData | EncryptedKiyoVaultData): Promise<void>,
  async getActiveFileInfo(fileName: string): Promise<FileRecord | undefined>,
  async getAllFiles(): Promise<FileRecord[]>,
  async resolveFileName(baseName: string): Promise<string>,   // dedup with `(N)` suffix
  async deleteFileRecord(fileName: string): Promise<void>,
  async getActiveFileName(): Promise<string | null>,
};
```

### resolveFileName (multi-vault dedup)

```typescript
async resolveFileName(baseName: string): Promise<string> {
  const existing = await this.getAllFiles();
  const used = new Set(existing.map(f => f.fileName));
  if (!used.has(baseName)) return baseName;
  for (let n = 1; n < 1000; n++) {
    const candidate = `${baseName.replace(/\.json$/, "")} (${n}).json`;
    if (!used.has(candidate)) return candidate;
  }
  return baseName;  // fallback
}
```

The `(N)` suffix dedup ensures imported backups with name collisions don't overwrite existing vaults.

### PK = fileName

Since schema v14, the `files` PK is the fileName itself (not a separate UUID). The unique constraint is enforced by the PK; `upsertFileRecord` is a `put` under the hood.

## syncQueue

`/src/database/syncQueue.ts` is the concurrency primitive for auto-save. Every `accountStore._persistAccounts` / `templateStore._persistTemplates` call goes through `enqueuePersistVaultSnapshot`.

```typescript
const queue: Task[] = [];
let processing = false;

export function enqueuePersistVaultSnapshot(getParams: ParamsGetter): Promise<void>
export function waitForQueueDrain(): Promise<void>        // tests
export function getQueueLength(): number                  // debug
export function isQueueProcessing(): boolean              // debug
```

The queue:
- Serializes: one snapshot at a time (`processing` guard).
- Coalesces by reading the latest session state at execution time via `getParams()` (not at enqueue time).
- Resolves every task with `resolve()` on completion or with `resolve()` even on failure (no rejections — auto-save is best-effort).
- Test helper `waitForQueueDrain` polls `queue.length === 0 && !processing` every 10ms and resolves.
- Debug helpers expose the queue state for the in-DOM `window.__KIYO_DEBUG__` object.

See [Sync Queue](sync-queue.md) for the full contract.

## Source Anchors

- `accountTable.ts` — `/src/database/accountTable.ts`
- `templateTable.ts` — `/src/database/templateTable.ts`
- `fileTable.ts` — `/src/database/fileTable.ts`
- `syncQueue.ts` — `/src/database/syncQueue.ts`
- `db.ts` — `/src/database/db.ts`

## Tests

- `accountTable.integration.test.ts`
- `templateTable.integration.test.ts`
- `fileTable.integration.test.ts` (multi-vault cases)