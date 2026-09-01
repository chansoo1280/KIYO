---
type: android-component
title: AutofillRepository
description: Top-level repository facade. Per-request fresh lifecycle, two-stage query (index → main), and one-shot sync that rebuilds both DBs.
tags: [android, repository, sqlcipher, autofill, two-stage]
---

# AutofillRepository

`/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt` is the top-level repository facade. It is constructed per-request (never cached) and exposes all DB operations used by the autofill service and the Capacitor sync plugin.

## AutofillAccount

```kotlin
data class AutofillAccount(
    val id: Long = -1,
    val username: String,
    val password: String,
    val domain: String?,
    val packageNames: List<String>,
    val appName: String? = null,
    val title: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
```

Stored in the main DB. Sensitive fields (`username`, `password`) are encrypted by SQLCipher using `DB_KEY` (auth-required, Keystore-wrapped). Non-sensitive metadata may also be encrypted by SQLCipher transparently.

## Construction

```kotlin
companion object {
    fun create(context: Context, dbKey: ByteArray, indexKey: ByteArray): AutofillRepository
    fun createForIndexOnly(context: Context, indexKey: ByteArray): AutofillRepository
}
```

Two factories, matching the two-stage fill design:

- `create(dbKey, indexKey)` opens both DBs. Used by `onFillRequest` stage 2 and `onSaveRequest`.
- `createForIndexOnly(indexKey)` opens only the index DB. Used by `onFillRequest` stage 1 to avoid triggering `UserNotAuthenticatedException`.

## Lifecycle

```kotlin
fun close()
```

Closes both DB connections. Always called in `KiyoAutofillService.onFillRequest` / `onSaveRequest` `finally` blocks. Leaking a connection holds the SQLCipher key in memory and prevents the next per-request `create()` from acquiring a fresh connection.

## Two-Stage Query

```kotlin
fun findMatchingAccountIdsByIndex(domain: String?, packageNames: List<String>): List<Long>
fun getAccountsByIds(ids: List<Long>): List<AutofillAccount>
```

### findMatchingAccountIdsByIndex

Used by stage 1. Queries the index DB:

```sql
SELECT account_id FROM autofill_index
WHERE domain = ?
   OR package_names LIKE ?
   OR (? AND domain IS NULL AND package_names IS NULL)
```

Returns only `account_id` (the main DB row ID), not credentials. Match logic delegates to `DomainMatcher.matches()` to support exact + subdomain matches.

### getAccountsByIds

Used by stage 2. Opens the main DB (or reuses it if already open in this request) and fetches full accounts:

```sql
SELECT * FROM autofill_accounts WHERE _id IN (?, ?, ?)
```

## Write Operations

```kotlin
fun upsertAccount(account: AutofillAccount): Long
fun deleteAccount(id: Long): Int
fun clearAll(): Int
```

`upsertAccount` inserts a new account when `id == -1` or updates the existing row otherwise. Used by both `KiyoAutofillService.onSaveRequest` (per-save) and `KiyoAutofillPlugin.syncAccountsFromReact` (batch sync).

## Sync Pipeline

```kotlin
fun syncAndRebuildIndex(accountsJson: String): SyncResult
```

Triggered by `AutofillSyncManager.sync` after `KiyoAutofillPlugin.syncAccountsFromReact`. The pipeline:

1. Parse the JSON list of accounts (React format) via `AccountMapper.parseAccounts(accountsJson)`.
2. For each account: `upsertAccount(account)`.
3. After all upserts: rebuild the index DB from the current main DB rows (`DELETE FROM autofill_index; INSERT INTO autofill_index SELECT ...`).
4. Return `SyncResult(syncedCount, errorCount, success, securityUpgrade)`.

The full index rebuild on every sync ensures the index never drifts from the main DB. The cost is acceptable because sync only happens on vault mutations (user edits), not on every fill.

## Per-Request Fresh Repository Invariant

Every call site (fill, save, sync) constructs a fresh `AutofillRepository` and closes it in `finally`. There is no static instance or singleton. This is the v3 design principle that ensures rewrap/reset/upgrade events take effect immediately without any stale-state cache.

## Source Anchors

- `AutofillRepository.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt`
- Stage 1 caller — `/android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt` (`onFillRequest`)
- Sync caller — `/android/app/src/main/java/com/kiyo/app/capacitor/AutofillSyncManager.kt`
- Domain matching — `DomainMatcher.kt`
- Account parsing — `AccountMapper.kt`

## Tests

- `/android/app/src/test/java/com/kiyo/app/autofill/repository/DomainMatcherTest.kt`
- `/android/app/src/test/java/com/kiyo/app/autofill/repository/AccountMapperTest.kt`
- `/android/app/src/test/java/com/kiyo/app/capacitor/AutofillSyncManagerTest.kt`