---
type: android-component
title: AutofillIndexDatabaseHelper
description: Non-auth SQLCipher index DB (kiyo_autofill_index.db) storing only account_id + domain + package_names for pre-auth matching.
tags: [android, sqlcipher, autofill, index-db, matching-layer]
---

# AutofillIndexDatabaseHelper

`/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillIndexDatabaseHelper.kt` manages the **non-auth** index database (`kiyo_autofill_index.db`) introduced by the Autofill Matching Layer plan (2026-08-28).

## Purpose

The index DB exists to enable fast, **authentication-free** matching during stage 1 of `KiyoAutofillService.onFillRequest`. By storing only metadata (account_id, domain, package_names) in a separate SQLCipher database encrypted with a **non-auth** `INDEX_KEY`, the service can answer "does this app/domain have any saved credentials?" without prompting the user for device-credential auth.

## Schema

```sql
CREATE TABLE autofill_index (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,    -- FK to main DB (no FK constraint)
    domain TEXT,                    -- encrypted by SQLCipher
    package_names TEXT,             -- JSON array; encrypted by SQLCipher
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_autofill_index_domain ON autofill_index(domain);
CREATE INDEX idx_autofill_index_account ON autofill_index(account_id);
```

## Non-credential invariant

The index DB **never** stores `username` or `password`. Even if an attacker extracts the index DB file and the `INDEX_KEY` from Keystore, they obtain only domain/package associations — useful for fingerprinting but not for credential theft.

## DATABASE_VERSION

```kotlin
companion object {
    private const val DATABASE_NAME = "kiyo_autofill_index.db"
    private const val DATABASE_VERSION = 1
    // ...
}
```

Version 1 is the initial schema. No migrations yet.

## Lifecycle

Same pattern as `AutofillDatabaseHelper` (manual `PRAGMA user_version`, `SQLiteOpenHelper` not extended). The helper holds one `SQLiteDatabase` instance per `AutofillRepository`.

## Rebuild on Sync

On every `syncAndRebuildIndex(accountsJson)` call (after `KiyoAutofillPlugin.syncAccountsFromReact`), the index table is dropped and rebuilt from the current main DB rows:

```kotlin
fun syncAndRebuildIndex(mainDb: AutofillDatabaseHelper): Int {
    val db = getWritableDatabase()
    db.beginTransaction()
    try {
        db.execSQL("DELETE FROM $TABLE_INDEX")
        mainDb.forEachAccount { account ->
            db.execSQL(
                "INSERT INTO $TABLE_INDEX ($COLUMN_ACCOUNT_ID, $COLUMN_DOMAIN, $COLUMN_PACKAGE_NAMES, $COLUMN_UPDATED_AT) VALUES (?, ?, ?, ?)",
                arrayOf(account.id, account.domain, JSONArray(account.packageNames).toString(), account.updatedAt)
            )
        }
        db.setTransactionSuccessful()
    } finally {
        db.endTransaction()
    }
    return updatedCount
}
```

The full rebuild guarantees consistency with the main DB without per-row change tracking.

## Source Anchors

- `AutofillIndexDatabaseHelper.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillIndexDatabaseHelper.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt` (`findMatchingAccountIdsByIndex`, `syncAndRebuildIndex`)
- Stage 1 caller — `/android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt` (`onFillRequest`)
- INDEX_KEY alias — `/android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt` (`INDEX_KEY_ALIAS`)
- Plan reference — comment block in `AutofillIndexDatabaseHelper.kt` and `KeystoreManager.kt` (Autofill Matching Layer plan 2026-08-28)