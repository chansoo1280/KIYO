---
type: data-model
title: AutofillAccount (Kotlin)
description: Kotlin data class for autofill credentials persisted in the SQLCipher autofill DB; the native counterpart to React Account.
tags: [data-model, autofill, kotlin, sqlcipher]
---

# AutofillAccount (Kotlin)

`/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt` defines the `AutofillAccount` data class as the native persistence model.

## Data Class

```kotlin
data class AutofillAccount(
    val id: Long = -1,                  // Autoincrement PK in `accounts` table
    val username: String,               // Plaintext (DB is encrypted at rest by SQLCipher)
    val password: String,               // Plaintext (DB is encrypted at rest by SQLCipher)
    val domain: String,                 // Normalized hostname (e.g., "google.com")
    val packageNames: List<String> = emptyList(),  // Android packages (e.g., ["com.google.android.googlequicksearchbox"])
    val appName: String? = null,
    val title: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
```

The DB_KEY (`kiyo_master_key_N`-wrapped) protects this data at rest. There is **no additional per-field encryption** — the SQLCipher page-level encryption is the layer.

## Mapping from React

`/android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt::parseReactAccount` converts the React `getAutofillAccounts()` payload (sent via `syncAccountsFromReact` JSON) into an `AutofillAccount`:

```kotlin
fun parseReactAccount(json: JSONObject): AutofillAccount {
    return AutofillAccount(
        id = -1,
        username = json.getString("username"),
        password = json.getString("password"),
        domain = json.optString("domain", ""),
        packageNames = json.optJSONArray("packageNames")?.toStringList() ?: emptyList(),
        // ...
    )
}
```

## Upsert Policy

`AutofillRepository.upsertAccount(account)` looks up an existing row by `(domain, username)` first; if found, updates `password` + `updatedAt`; otherwise inserts a new row with autoincrement id.

## Source Anchors

- `AutofillRepository.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt`
- Mapper — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt`
- Sync — `/src/store/accountStore.ts::getAutofillAccounts`, `/src/plugins/kiyautofill.ts::syncAccountsFromReact`