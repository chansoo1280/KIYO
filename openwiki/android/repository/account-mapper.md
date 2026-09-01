---
type: android-component
title: AccountMapper
description: Parses the JSON account list sent from React (syncAccountsFromReact) into AutofillAccount instances.
tags: [android, json, mapper, autofill]
---

# AccountMapper

`/android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt` parses the JSON payload sent by React via `KiyoAutofillPlugin.syncAccountsFromReact({ accountsJson })` into a list of `AutofillAccount` instances suitable for `AutofillRepository.upsertAccount`.

## Input Format

The React `accountStore.syncToAutofill()` serializes a list of objects:

```json
[
  {
    "username": "alice@example.com",
    "password": "<base64 encoded ciphertext>",
    "domain": "github.com",
    "packageNames": [],
    "appName": "GitHub",
    "title": "Alice's GitHub"
  },
  ...
]
```

The `password` field carries the React vault's encrypted ciphertext (raw base64 of the AES-GCM ciphertext + tag), not plaintext. Decryption is performed lazily when the autofill service fills a credential — the database stores the encrypted blob so that a DB dump without `DB_KEY` is useless.

## API

```kotlin
object AccountMapper {
    fun parseAccounts(json: String): List<AutofillAccount>
    fun parseAccount(element: JSONObject): AutofillAccount?
}
```

## Behavior

`parseAccounts`:

1. Parse the top-level JSON array.
2. For each element, call `parseAccount(element)`.
3. Skip and log elements that fail to parse (returns `null`).
4. Return the surviving list.

`parseAccount`:

1. Read `username` (string, required). Skip if missing or empty.
2. Read `password` (string, required). Skip if missing or empty.
3. Read `domain` (string, nullable).
4. Read `packageNames` (JSON array of strings, default empty).
5. Read `appName` (string, nullable).
6. Read `title` (string, nullable).
7. Construct `AutofillAccount` with `id = -1` (signals insert) and current timestamps.

Errors are logged via `Log.w(TAG, ...)` but never thrown — sync continues with the next account.

## Source Anchors

- `AccountMapper.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt` (`syncAndRebuildIndex`)
- React producer — `/src/store/accountStore.ts` (`getAutofillAccounts`, `syncToAutofill`)

## Tests

- `/android/app/src/test/java/com/kiyo/app/autofill/repository/AccountMapperTest.kt`