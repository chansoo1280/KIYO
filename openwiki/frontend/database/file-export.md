---
type: reference
title: File Export (SAF)
description: SAF (Storage Access Framework) backup operations on Android. Includes exportBackupFile, importBackupFile, writeBackupToUri, readBackupFromUri, and pickBackupFolder, plus web-download fallback.
tags: [database, file-export, saf, backup, auto-backup]
---

# File Export (SAF)

`/src/database/fileExport.ts` is the SAF (Storage Access Framework) bridge for vault backup operations. It is distinct from `fileStorage.ts::exportDataFile` which writes the primary full-vault file to the Documents directory.

## Pages

- [File Storage](file-storage.md) — Documents-directory full export lives here.
- This file — SAF backup + auto-backup flow.

## API

```typescript
export const isNativeFileStorageAvailable: () => boolean

export const normalizeDataFileName: (fileName: string) => string
// e.g. "kiyo-data" → "kiyo-data.json"; "kiyo.json" → "kiyo.json"

export const exportBackupFile: (fileName, data) => Promise<{success, uri?}>
// SAF ACTION_CREATE_DOCUMENT (user picks folder) → writes to content:// URI
// On web: blob download

export const importBackupFile: () => Promise<{success, data?, uri?}>
// SAF ACTION_OPEN_DOCUMENT (user picks file) → reads content:// URI

export const writeBackupToUri: (uri, data) => Promise<{success, errorCode?, errorMessage?}>
// Writes to an existing SAF URI. Used by auto-backup.

export const readBackupFromUri: (uri) => Promise<string | null>
// Reads from an existing SAF URI.

export const pickBackupFolder: () => Promise<{success, uri?}>
// SAF ACTION_OPEN_DOCUMENT_TREE → returns a content:// URI to be persisted.
```

## Auto-Backup Flow

The auto-backup feature writes the encrypted vault snapshot to a user-chosen SAF folder on every successful `persistVaultSnapshot`:

```mermaid
flowchart LR
    A[persistVaultSnapshot] --> B{autoBackupEnabled && autoBackupUri?}
    B -->|No| Z[Done]
    B -->|Yes| C[cryptoKey && salt?]
    C -->|No| Z
    C -->|Yes| D[encryptData snapshot]
    D --> E[writeBackupToUri]
    E -->|success| F[Done]
    E -->|PERMISSION_REVOKED| G[setAutoBackupEnabled(false)]
    E -->|other failure| H[Log warn, leave enabled]
```

The `PERMISSION_REVOKED` error code is returned by `KiyoFilePlugin.writeToUri` when the persisted URI permission was revoked by the user (e.g., they deleted the backup folder). The React side auto-disables auto-backup in this case and surfaces a `SyncErrorBanner`.

## Web Fallback

`isNativeFileStorageAvailable()` returns `false` on web. In that case:

- `exportBackupFile` creates a `Blob` and triggers an `<a download>` click.
- `importBackupFile` throws `FILE_READ_FAILED` (caller must use an `<input type="file">` instead).
- `writeBackupToUri` returns `{success: false, errorCode: "WEB_UNSUPPORTED"}`.
- `pickBackupFolder` returns `{success: false}`.

## Consumer

```typescript
import { exportBackupFile, importBackupFile, writeBackupToUri, pickBackupFolder } from "@/database/fileExport";
```

- `/src/pages/Settings/components/DataSection.tsx` — manual backup + restore buttons.
- `/src/database/db.ts::tryTriggerAutoBackup` — auto-backup trigger.

## Source Anchors

- `fileExport.ts` — `/src/database/fileExport.ts`
- Plugin — `/android/app/src/main/java/com/kiyo/app/capacitor/KiyoFilePlugin.kt`
- Web stub — `/src/plugins/kiyofile.ts`, `/src/plugins/kiyofile.web.ts`
- Trigger — `/src/database/db.ts::tryTriggerAutoBackup`