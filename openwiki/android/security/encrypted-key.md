---
type: android-component
title: EncryptedKey
description: JSON serialization for {iv, ciphertext} blobs that wrap DB_KEY in DataStore.
tags: [android, encrypted-key, json, data-store]
---

# EncryptedKey

`/android/app/src/main/java/com/kiyo/app/security/EncryptedKey.kt` is the JSON serialization used to persist the GCM-encrypted DB_KEY in DataStore.

## Schema

```kotlin
data class EncryptedKey(
    val iv: ByteArray,
    val ciphertext: ByteArray  // includes GCM tag
)
```

JSON representation:

```json
{
    "iv": "base64(12 bytes)",
    "ciphertext": "base64(N bytes including 16-byte GCM tag)"
}
```

## API

```kotlin
companion object {
    fun toJson(key: EncryptedKey): String
    fun fromJson(json: String): EncryptedKey
}
```

## Implementation

```kotlin
fun toJson(key: EncryptedKey): String {
    val ivB64 = Base64.encodeToString(key.iv, Base64.NO_WRAP)
    val ctB64 = Base64.encodeToString(key.ciphertext, Base64.NO_WRAP)
    return """{"iv":"$ivB64","ciphertext":"$ctB64"}"""
}

fun fromJson(json: String): EncryptedKey {
    val obj = JSONObject(json)
    val iv = Base64.decode(obj.getString("iv"), Base64.NO_WRAP)
    val ct = Base64.decode(obj.getString("ciphertext"), Base64.NO_WRAP)
    return EncryptedKey(iv, ct)
}
```

The format is identical to the React vault's `EncryptedKiyoVaultData` (which has the additional `salt`, `version`, `encrypted` fields). The Android side does not need `salt` because the PBKDF2 key derivation happens at the React layer; on Android, the master key comes directly from Keystore.

## Storage

The serialized JSON is stored in `kiyo_security_prefs` DataStore under the `db_encrypted_key` preference:

```kotlin
private val DB_ENCRYPTED_KEY = stringPreferencesKey("db_encrypted_key")
```

## Source Anchors

- `EncryptedKey.kt` — `/android/app/src/main/java/com/kiyo/app/security/EncryptedKey.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt` (`getKey`, `rewrapDbKey`, `generateFreshStateAfterReset`)
- Storage — `/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt` (`securityDataStore` extension)
- Encryption — `/android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt` (`encrypt`, `decrypt`)