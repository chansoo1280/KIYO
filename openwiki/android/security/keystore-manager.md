---
type: android-component
title: KeystoreManager
description: alias-keyed AES-256-GCM keys in AndroidKeyStore with no caching. Supports both auth-required (autofill master) and non-auth (INDEX_KEY) generation.
tags: [android, keystore, aes-gcm, alias]
---

# KeystoreManager

`/android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt` is the wrapper around Android Keystore that manages the AES-256-GCM keys used to wrap the SQLCipher `DB_KEY` and the non-auth `INDEX_KEY`.

## Alias Families

```kotlin
const val LEGACY_KEY_ALIAS = "kiyo_master_key"             // legacy single alias
const val INDEX_KEY_ALIAS = "kiyo_index_key"               // current non-auth index master
private const val INDEXED_ALIAS_PREFIX = "kiyo_master_key_" // base for indexed autofill masters
```

In addition, `DatabaseKeyManager` (a separate file) declares:

```kotlin
private const val INDEX_MASTER_ALIAS = "kiyo_index_master_key" // legacy index master
```

The indexed autofill master aliases are `kiyo_master_key_1`, `kiyo_master_key_2`, ... assigned incrementally when the existing alias needs an upgrade. The current pointer is stored in `kiyo_security_prefs` DataStore as `current_master_key_alias`.

## Design Principle: No Caching

Every public function reads the current Keystore state from scratch. There is no static cache (the `cachedKey: SecretKey?` field present in `SecureKeyManager` does **not** exist here). The rationale: after a `DatabaseKeyManager.rewrapDbKey` or KPInvalidated reset, the next call must read the new alias — caching would force a stale-key failure.

## Key Generation

```kotlin
private fun generateNewKey(keyStore: KeyStore, alias: String, requireAuth: Boolean = true) {
    val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
    val builder = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
    if (requireAuth && isSecureLockScreenEnabled()) {
        builder.setUserAuthenticationRequired(true)
            .setUserAuthenticationParameters(30 * 60, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
    }
    // invalidate-on-enrollment is enabled for auth-required keys
    keyGenerator.init(builder.build())
    keyGenerator.generateKey()
}
```

`requireAuth = true` (default) creates an auth-required key **only when** the device lock-screen is enabled; otherwise the key is non-auth (the assumption is that without a lock screen, there is no auth to require).

`requireAuth = false` is used exclusively by `getOrCreateIndexKey()` to force a non-auth key even when a lock screen exists.

## Public API

```kotlin
fun getOrCreateKey(): SecretKey                              // legacy alias
fun getOrCreateKey(alias: String): SecretKey                 // explicit alias
fun getOrCreateKey(alias: String, requireAuth: Boolean): SecretKey
fun getOrCreateIndexKey(): SecretKey                         // kiyo_index_key, always non-auth
fun createKey(alias: String): SecretKey                      // always create (no lookup)
fun deleteKey(alias: String): Boolean
fun needsSecurityUpgrade(currentAlias: String): Boolean
fun isSecurityDowngrade(currentAlias: String): Boolean
fun encrypt(masterKey: SecretKey, plainKey: ByteArray): EncryptedKey
fun decrypt(masterKey: SecretKey, encrypted: EncryptedKey): ByteArray
```

## Security Upgrade Detection

```kotlin
fun needsSecurityUpgrade(currentAlias: String): Boolean
```

Returns `true` when:

- The device has a secure lock screen enabled (`KeyguardManager.isKeyguardSecure()`).
- The current alias's key in Keystore does **not** require user authentication.

This happens when the user installs the app without a lock screen (auth not required) and later adds a lock screen (now auth should be required). The caller (`DatabaseKeyManager.getKey`) reacts by invoking `rewrapDbKey` to upgrade the wrapping to a new auth-required key.

## Security Downgrade Detection

```kotlin
fun isSecurityDowngrade(currentAlias: String): Boolean
```

The mirror case: the current key requires auth but the lock screen has been removed. Called by `KiyoAutofillPlugin.syncAccountsFromReact` before sync — a downgrade triggers `resetAutofillData` and the sync re-creates the wrapping under a non-auth key.

## encrypt / decrypt

```kotlin
fun encrypt(masterKey: SecretKey, plainKey: ByteArray): EncryptedKey {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, masterKey)
    val iv = cipher.iv
    require(iv.size == 12)
    val ciphertext = cipher.doFinal(plainKey)
    require(ciphertext.size == plainKey.size + 16) // GCM tag
    return EncryptedKey(iv, ciphertext)
}

fun decrypt(masterKey: SecretKey, encrypted: EncryptedKey): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    val spec = GCMParameterSpec(16 * 8, encrypted.iv)
    cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)
    return cipher.doFinal(encrypted.ciphertext)
}
```

GCM with 12-byte IV and 16-byte tag (128-bit). The IV is stored alongside the ciphertext in `EncryptedKey`.

## Init Context

```kotlin
@Volatile private var appContext: Context? = null
fun init(context: Context) { if (appContext == null) appContext = context.applicationContext }
```

Context is required only for `isSecureLockScreenEnabled()` (which queries `KeyguardManager`). `DatabaseKeyManager` calls `KeystoreManager.init(context)` before any upgrade/downgrade decision.

## Source Anchors

- `KeystoreManager.kt` — `/android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt`
- EncryptedKey — `/android/app/src/main/java/com/kiyo/app/security/EncryptedKey.kt`

## Tests

- `/android/app/src/test/java/com/kiyo/app/security/KeystoreManagerTest.kt`