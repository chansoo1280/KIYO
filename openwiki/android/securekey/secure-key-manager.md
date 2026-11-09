---
type: android-component
title: SecureKeyManager
description: kiyo_secure_master_key lifecycle, AES-256-GCM encrypt/decrypt, biometric enrollment invalidation handling.
tags: [android, securekey, keystore, aes-gcm]
---

# SecureKeyManager

`/android/app/src/main/java/com/kiyo/app/securekey/SecureKeyManager.kt` manages `kiyo_secure_master_key`, the Keystore master key used to wrap the React vault `cryptoKey` for biometric unlock.

## Key Alias

```kotlin
private const val KEY_ALIAS = "kiyo_secure_master_key"
```

Distinct from `kiyo_master_key_N` (autofill master, see `DatabaseKeyManager`). The two key families are completely separate — biometric enrollment changes invalidate `kiyo_secure_master_key` but do not affect the autofill master.

## Key Spec

```kotlin
KeyGenParameterSpec.Builder(KEY_ALIAS, PURPOSE_ENCRYPT or PURPOSE_DECRYPT)
    .setBlockModes(BLOCK_MODE_GCM)
    .setEncryptionPaddings(ENCRYPTION_PADDING_NONE)
    .setKeySize(256)
    .setUserAuthenticationRequired(true)
    .setUserAuthenticationParameters(30 * 60, AUTH_BIOMETRIC_STRONG)
    .setInvalidatedByBiometricEnrollment(true)
```

- 30-minute auth validity window.
- `AUTH_BIOMETRIC_STRONG` only (no device-credential fallback).
- Biometric enrollment change invalidates the key.

## Caching (contrast with KeystoreManager)

Unlike `KeystoreManager` (no caching), `SecureKeyManager` caches the loaded `SecretKey` reference for the lifetime of the process:

```kotlin
private var cachedKey: SecretKey? = null

fun getOrCreateKey(): SecretKey {
    if (cachedKey != null) return cachedKey!!
    // ...
}
```

The rationale: the secure-key flow is invoked from a Capacitor plugin call (storeKey / unlockKeyWithBiometric), not from a per-FillRequest background thread. Caching here is safe because:

1. Each Capacitor call gets the key, performs one cipher operation, returns.
2. The cached key reference is invalidated by `clearCache()` (used by tests) and by `KeyPermanentlyInvalidatedException` handling (which deletes and recreates the key).

## Invalidation Handling

```kotlin
} catch (e: KeyPermanentlyInvalidatedException) {
    Log.w(TAG, "Secure master key permanently invalidated (biometric changed), recreating")
    deleteKeyInternal(keyStore)
    generateNewKey(keyStore)
}
```

On `KeyPermanentlyInvalidatedException` (biometric enrollment changed), the old key is deleted from Keystore and a fresh one is generated. The old `encrypted_key` blob in SharedPreferences becomes garbage (decryption will fail with `AEADBadTagException`) — the React side must re-enroll biometric, which writes a new blob.

## encrypt / decrypt

```kotlin
fun encrypt(masterKey: SecretKey, plainKey: ByteArray): EncryptedKey { /* AES/GCM/NoPadding, 12-byte IV, 16-byte tag */ }
fun decrypt(masterKey: SecretKey, encrypted: EncryptedKey): ByteArray { /* reverse of encrypt */ }
```

Note: these methods are called **without** a CryptoObject — the actual cipher operation with biometric binding happens in `BiometricAuthHelper` after the biometric prompt.

## API

```kotlin
@Throws(Exception::class) fun getOrCreateKey(): SecretKey
fun encrypt(masterKey: SecretKey, plainKey: ByteArray): EncryptedKey
fun decrypt(masterKey: SecretKey, encrypted: EncryptedKey): ByteArray
@Throws(Exception::class) fun deleteKey(): Boolean
internal fun clearCache()
fun hasKey(): Boolean
```

## Source Anchors

- `SecureKeyManager.kt` — `/android/app/src/main/java/com/kiyo/app/securekey/SecureKeyManager.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelper.kt`