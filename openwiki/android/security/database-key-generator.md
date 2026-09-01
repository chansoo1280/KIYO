---
type: android-component
title: DatabaseKeyGenerator
description: Generates the random 32-byte DB_KEY used for SQLCipher encryption.
tags: [android, key-generator, secure-random]
---

# DatabaseKeyGenerator

`/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyGenerator.kt` generates the random 32-byte DB_KEY used to open the SQLCipher database.

## API

```kotlin
object DatabaseKeyGenerator {
    fun generateKey(): ByteArray  // 32 random bytes
}
```

## Implementation

```kotlin
fun generateKey(): ByteArray {
    val secureRandom = java.security.SecureRandom()
    val bytes = ByteArray(32)
    secureRandom.nextBytes(bytes)
    return bytes
}
```

Uses `java.security.SecureRandom` (which on Android delegates to `OpenSSL`/`/dev/urandom`). 32 bytes = 256 bits = the SQLCipher `AES-256` key size.

## When it runs

- On first `DatabaseKeyManager.getKey` call (no DB_ENCRYPTED_KEY present in DataStore) — generates a fresh DB_KEY.
- After `KPInvalidatedException` or `AEADBadTagException` reset — generates a fresh DB_KEY and a new alias.
- After `rewrapDbKey` atomic upgrade — does **not** regenerate (preserves the same DB_KEY under a new alias to avoid invalidating the autofill DB).

The DB_KEY never leaves memory except via `KeystoreManager.encrypt` → DataStore blob. There is no path that writes the plaintext DB_KEY to disk.

## Source Anchors

- `DatabaseKeyGenerator.kt` — `/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyGenerator.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt` (`generateAndStoreKey`, `generateFreshStateAfterReset`)