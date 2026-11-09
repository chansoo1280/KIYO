---
type: android-component
title: AutofillDatabaseHelper
description: SQLCipher-backed main DB (kiyo_autofill.db) with auth-required DB_KEY, manual migrations, and v6 encryption drop-and-recreate.
tags: [android, sqlcipher, autofill, main-db, migration]
---

# AutofillDatabaseHelper

`/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillDatabaseHelper.kt` manages the main credential database (`kiyo_autofill.db`). The DB is encrypted by SQLCipher using the auth-required `DB_KEY` (wrapped by `kiyo_master_key_N` alias in Keystore).

## Schema

```sql
CREATE TABLE autofill_accounts (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    domain TEXT,
    package_names TEXT,           -- JSON array
    app_name TEXT,
    title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_autofill_accounts_domain ON autofill_accounts(domain);
CREATE INDEX idx_autofill_accounts_updated ON autofill_accounts(updated_at);
```

All columns are encrypted at rest by SQLCipher; only indexes on `domain` and `updated_at` are exposed in plaintext (used for matching performance).

## DATABASE_VERSION

```kotlin
companion object {
    private const val DATABASE_NAME = "kiyo_autofill.db"
    private const val DATABASE_VERSION = 6 // Incremented for encryption migration
    // ...
}
```

The current version is **6**, with the latest bump reserved for the encryption migration that switched the column-level encryption policy.

## Manual PRAGMA user_version pattern

Unlike `SQLiteOpenHelper`, this helper does not extend the framework class — the manual pattern is intentional:

```kotlin
val cursor = newDb.rawQuery("PRAGMA user_version", null)
var version = 0
if (cursor.moveToFirst()) version = cursor.getInt(0)
cursor.close()

when {
    version == 0 -> {
        onCreate(newDb)
        newDb.execSQL("PRAGMA user_version = $DATABASE_VERSION")
    }
    version < DATABASE_VERSION -> {
        onUpgrade(newDb, version, DATABASE_VERSION)
        newDb.execSQL("PRAGMA user_version = $DATABASE_VERSION")
    }
}
```

This avoids the JNI critical-section reentrancy deadlock documented in SQLCipher 4.6.1 issue #48 when using hooks.

## Lifecycle

```kotlin
fun getReadableDatabase(): SQLiteDatabase
fun getWritableDatabase(): SQLiteDatabase
fun close()
```

The helper holds a single `SQLiteDatabase` instance and reuses it on subsequent calls until `close()` is invoked. Always called from `AutofillRepository.close()` in a `finally` block.

## Encryption Migration (v6)

The v6 migration is special: it cannot run inside a single SQLCipher transaction because the data is encrypted under a different key than the column-level protection expects. The implementation drops affected tables and recreates them:

```kotlin
private fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    // ... earlier versions ...
    if (oldVersion < 6) {
        db.execSQL("DROP TABLE IF EXISTS autofill_accounts")
        onCreate(db)
    }
}
```

The credentials are ephemeral at this point — `DatabaseKeyManager` has already determined the wrapping key matches, and the rebuild happens on the next `syncAccountsFromReact` from React. Data loss is non-issue because the source of truth is the React vault; the autofill DB is a cache.

## Source Anchors

- `AutofillDatabaseHelper.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillDatabaseHelper.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt` (`create`, `getReadableDatabase`, `getWritableDatabase`)
- Migration context — `/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt` (`resetAutofillData`, called after `KeyPermanentlyInvalidatedException`)