# Separate Internal Auto-save from External Backup Export

## Problem

Current `syncDatabaseToFile()` couples **internal auto-save** (updating `files` table in IndexedDB) with **external backup export** (writing to `/Documents/kiyo-*.json` via Capacitor Filesystem).

```text
CRUD → syncDatabaseToFile() → files table + exportVaultFile() → Documents/
```

This causes:
- Unnecessary external file writes on every CRUD
- No user control over backup location (Android 11+ Scoped Storage)
- Confusion between "app state persistence" and "user-initiated backup"

## Solution

**Decouple**: `files` table = canonical internal state. `exportVaultFile()` = explicit user backup via SAF.

```
                    ┌──────────────────┐
                    │     IndexedDB     │
                    │                  │
                    │ accounts         │
                    │ templates        │
                    │ files (snapshot) │ ◄── Internal canonical data
                    └────────┬─────────┘
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
            Auto-save            Explicit Backup
            (every CRUD)         (user action)
                   │                   │
                   ▼                   ▼
            files table          Android SAF
            upsert only          → kiyo-backup.json
```

## Changes

### 1. `syncDatabaseToFile()` → `persistVaultSnapshot()` (or `syncDatabaseToVaultRecord()`)

**File**: `src/database/db.ts`

- Remove `exportVaultFile()` call
- Only: `getDatabaseSnapshot()` → encrypt → `fileTable.upsertFileRecord()`
- Rename to reflect actual behavior: sync DB → vault record (files table)

### 2. `exportVaultFile()` → `exportBackupFile()` / `backupVaultToSAF()`

**File**: `src/database/fileExport.ts`

- Change from `Filesystem.writeFile(path, data, Directory.Documents)` 
- To: SAF-based `ACTION_CREATE_DOCUMENT` (Capacitor plugin or native bridge)
- Accept optional `fileName` override (default: `kiyo-backup-<timestamp>.json`)
- Return URI/handle for future auto-backup reference

### 3. Remove `exportVaultFile()` from pipeline functions

**File**: `src/database/fileStorage.ts`

| Function | Current | After |
|----------|---------|-------|
| `createDataFile()` | `persistVaultRecord` → `setupVaultSession` → `exportVaultFile` | `persistVaultRecord` → `setupVaultSession` (no export) |
| `openImportedDataFile()` | `persistVaultRecord` → `setupVaultSession` → `exportVaultFile` → `replaceDatabaseData` | `persistVaultRecord` → `setupVaultSession` → `replaceDatabaseData` |
| `backupDataFile()` | `exportVaultFile` | Call new SAF-based export |

### 4. AccountStore / TemplateStore unchanged

They call `syncDatabaseToFile()` (renamed) → only updates `files` table. No external writes.

### 5. Add explicit backup UI

**Settings → Backup**:
- "백업 파일 만들기" → triggers SAF export
- "자동 백업 켜기" → stores SAF URI → on `persistVaultSnapshot()`, also write to that URI

## Android Implementation Notes

### SAF Export (one-time)
```kotlin
// Capacitor plugin or native bridge
val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
    addCategory(Intent.CATEGORY_OPENABLE)
    type = "application/json"
    putExtra(Intent.EXTRA_TITLE, "kiyo-backup-${System.currentTimeMillis()}.json")
}
startActivityForResult(intent, REQUEST_CODE_SAVE_BACKUP)
```

### Auto-backup (persistent URI)
```kotlin
// Store URI in DataStore/SharedPreferences
val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
contentResolver.takePersistableUriPermission(uri, takeFlags)
// Later: contentResolver.openOutputStream(uri).use { it.write(encryptedJson.toByteArray()) }
```

## Files to Modify

| File | Change |
|------|--------|
| `src/database/db.ts` | Remove export, rename function |
| `src/database/fileExport.ts` | Rewrite for SAF, rename |
| `src/database/fileStorage.ts` | Remove export calls from pipelines |
| `src/store/accountStore.ts` | No change (calls renamed function) |
| `src/store/templateStore.ts` | No change |
| Android: new Capacitor plugin or bridge | SAF export/auto-backup |

## Verification

1. CRUD (add/update/delete account) → only IndexedDB `files` table updates, no external file write
2. Settings → Backup → "백업 파일 만들기" → SAF picker opens → file saved to user-chosen location
3. Import backup file → restores IndexedDB, no auto-export to Documents
4. (Optional) Auto-backup ON → SAF URI stored → background writes to that URI on each snapshot

## Rollback Plan

If SAF implementation blocked:
- Keep `exportVaultFile()` as web-only (download blob)
- Android: show toast "Android 11+ requires manual backup via Settings"
- Defer SAF to next iteration