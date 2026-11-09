---
type: android-component
title: Autofill DB Migrations
description: PRAGMA user_version migration ladder for the main autofill DB (v0→v6) and the index DB (v0→v1).
tags: [android, sqlcipher, migration, pragma, user-version]
---

# Autofill Database Migrations

Both autofill databases use manual `PRAGMA user_version` migration ladders rather than `SQLiteOpenHelper`. This page consolidates the migration history for both DBs.

## Why manual PRAGMA

SQLCipher 4.6.1 has a documented JNI critical-section reentrancy deadlock (issue #48) when SQLite hooks are used. The 4-argument `openOrCreateDatabase(file, key, null, null)` signature used by both helpers avoids hooks entirely. As a side effect, the standard `SQLiteOpenHelper.onCreate` / `onUpgrade` machinery cannot be used, so the project implements its own version detection and migration ladder.

## Main DB Migration Ladder (`kiyo_autofill.db`)

| From | To | Migration | Rationale |
|------|----|-----------|-----------|
| 0 | 1 | Initial schema: `autofill_accounts` with plaintext columns | First release |
| 1 | 2 | Add `package_names` column | Android app autofill matching |
| 2 | 3 | Add `app_name`, `title` columns | UI display in dataset card |
| 3 | 4 | Add `idx_autofill_accounts_domain` index | Faster domain matching |
| 4 | 5 | Add `idx_autofill_accounts_updated` index | Faster index-rebuild ordering |
| 5 | 6 | **Encryption migration** — `DROP TABLE autofill_accounts; onCreate` | Switch column-level encryption policy |

The v5→v6 migration is special: SQLCipher's column-level encryption cannot be changed on existing data without re-encryption. The pragmatic choice is to drop and recreate; the next `syncAccountsFromReact` rebuilds from the React vault (the source of truth).

## Index DB Migration Ladder (`kiyo_autofill_index.db`)

| From | To | Migration |
|------|----|-----------|
| 0 | 1 | Initial schema: `autofill_index` with `(account_id, domain, package_names, updated_at)` |

No further migrations yet. The index DB is rebuilt on every full sync, so destructive migrations are cheap.

## Migration Trigger

```kotlin
private fun getDatabase(flags: Int): SQLiteDatabase {
    val dbFile = context.getDatabasePath(DATABASE_NAME)
    dbFile.parentFile?.mkdirs()
    val newDb = SQLiteDatabase.openOrCreateDatabase(dbFile, encryptionKey, null, null)
    database = newDb
    val cursor = newDb.rawQuery("PRAGMA user_version", null)
    var version = 0
    if (cursor.moveToFirst()) version = cursor.getInt(0)
    cursor.close()
    when {
        version == 0 -> { onCreate(newDb); newDb.execSQL("PRAGMA user_version = $DATABASE_VERSION") }
        version < DATABASE_VERSION -> { onUpgrade(newDb, version, DATABASE_VERSION); newDb.execSQL("PRAGMA user_version = $DATABASE_VERSION") }
    }
    return newDb
}
```

`onCreate` is called only for fresh DBs (version 0); `onUpgrade` is called only when the persisted version is strictly less than the compile-time constant.

## Migration Idempotency

Each `onUpgrade(oldVersion, newVersion)` step is **idempotent** — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DROP TABLE IF EXISTS` (where applicable). A user who skips an intermediate version (e.g., installs v6 directly on a v3 DB) goes through every step in sequence.

## Reset Path

When `DatabaseKeyManager` detects `KeyPermanentlyInvalidatedException` or `AEADBadTagException`, it invokes `resetAutofillData(context)` which deletes the autofill DB files:

```kotlin
context.deleteDatabase("kiyo_autofill.db")
context.deleteDatabase("kiyo_autofill_index.db")
```

The next request recreates them at `DATABASE_VERSION`. The React vault remains intact and re-syncs the credentials via `syncAccountsFromReact`.

## Source Anchors

- `AutofillDatabaseHelper.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillDatabaseHelper.kt` (version ladder)
- `AutofillIndexDatabaseHelper.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillIndexDatabaseHelper.kt` (version 1)
- Reset trigger — `/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt` (`resetAutofillData`)