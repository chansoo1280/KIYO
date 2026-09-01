---
type: android-component
title: BiometricAuthHelper
description: BiometricPrompt-based storeKey and unlockKeyWithBiometric using non-CryptoObject auth + separate cipher (Keystore2 CryptoObject crash workaround).
tags: [android, biometric, biometry, vault-unlock]
---

# BiometricAuthHelper

`/android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelper.kt` is the orchestration layer that drives the biometric prompt and performs the actual cipher operation against `SecureKeyManager`'s `kiyo_secure_master_key`.

## Non-CryptoObject Auth Model

The helper does **not** use the documented Android `BiometricPrompt.authenticate(CryptoObject)` pattern. Per the in-file comment:

> ⚠️ CryptoObject 경로는 사용하지 않는다 (2026-08-27 실측): Keystore2에서 cipher.init()이 UserNotAuthenticatedException 없이 성공해도 op handle이 지연/정리되어 BiometricPrompt.authenticate(CryptoObject) 시점에 "Crypto primitive not initialized"로 크래시난다. → non-crypto 프롬프트로 사용자 인증(키 30분 유효창 오픈) 후 init+doFinal. doFinal이 auth-required 키를 강제하므로 보안 등가이다 (유효창 닫히면 UNAE).

The actual flow:

1. Show non-CryptoObject `BiometricPrompt` (`setAllowedAuthenticators(BIOMETRIC_STRONG)`).
2. On `onAuthenticationSucceeded`, perform `cipher.init(ENCRYPT_MODE or DECRYPT_MODE, masterKey, ...)` and `cipher.doFinal(...)`.
3. The `doFinal` call requires auth for `kiyo_secure_master_key` (which has `setUserAuthenticationRequired(true)` and 30-minute validity). If the auth window is closed, `doFinal` throws `UserNotAuthenticatedException` — security-equivalent to CryptoObject flow.

## storeKey

```kotlin
suspend fun storeKey(vaultId: String, cryptoKeyBase64: String): Result<Unit> = withContext(Dispatchers.IO) {
    val masterKey = getOrCreateMasterKey()
    val plainKeyBytes = Base64.decode(cryptoKeyBase64, Base64.NO_WRAP)
    authenticateWithPrompt(
        title = "생체인증 등록",
        subtitle = "$vaultId 볼트의 암호화 키를 생체인증으로 보호합니다",
    ) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, masterKey)
        val ciphertext = cipher.doFinal(plainKeyBytes)
        saveEncryptedKeyToDataStore(cipher.iv, ciphertext)
    }
    Result.success(Unit)
}
```

After successful biometric prompt, encrypts the React `cryptoKey` (passed as base64) under the master key and persists `{iv, ciphertext}` JSON to `kiyo_secure_prefs` SharedPreferences under key `encrypted_key`.

## unlockKeyWithBiometric

```kotlin
suspend fun unlockKeyWithBiometric(vaultId: String): Result<String> = withContext(Dispatchers.IO) {
    val masterKey = getOrCreateMasterKey()
    val encryptedKey = readEncryptedKeyFromDataStore()
    val spec = GCMParameterSpec(GCM_TAG_LENGTH * 8, encryptedKey.iv)
    val plainKeyBytes = authenticateWithPrompt(
        title = "생체인증으로 로그인",
        subtitle = "$vaultId 볼트 잠금 해제",
    ) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)
        cipher.doFinal(encryptedKey.ciphertext)
    }
    Result.success(Base64.encodeToString(plainKeyBytes, Base64.NO_WRAP))
}
```

Returns the base64-encoded raw cryptoKey bytes. React (`Auth.tsx`) then calls `setCryptoKeyFromBase64(key, salt)` + `initializeStores()`.

## Exception Surface

### BiometricKeyCorruptedException

```kotlin
class BiometricKeyCorruptedException : Exception("저장된 생체인증 키가 손상되었습니다. 설정에서 생체인증을 다시 등록해 주세요.")
```

Thrown when `doFinal` raises `AEADBadTagException` (the stored `{iv, ciphertext}` blob was encrypted under a different master key — typically because biometric enrollment changed and `SecureKeyManager` invalidated the key without cleaning up the old blob).

`SecureKeyPlugin.unlockKeyWithBiometric` propagates this as a Capacitor reject with code `KEY_CORRUPTED`, which the React UI uses to surface a "re-enroll biometric" message.

### BiometricAuthException

```kotlin
class BiometricAuthException(errorCode: Int, message: String) : Exception(message)
```

Thrown by `BiometricPrompt` callbacks (`onAuthenticationError`, `onAuthenticationFailed`). Wraps the framework error codes so callers can distinguish user-cancel vs hardware failure vs no-biometric-enrolled.

## Storage Backend

```kotlin
companion object {
    private const val DATASTORE_NAME = "kiyo_secure_prefs"
    private const val ENCRYPTED_KEY_KEY = "encrypted_key"
}
```

Plain `SharedPreferences` (not Jetpack DataStore). This is distinct from `DatabaseKeyManager`'s `kiyo_security_prefs` DataStore — same prefix, different backend, different key being protected.

## hasKey / deleteKey / isBiometryAvailable

```kotlin
suspend fun hasKey(vaultId: String): Result<Boolean>
suspend fun deleteKey(vaultId: String): Result<Unit>
suspend fun isBiometryAvailable(): Result<BiometryAvailability>
```

Helpers used by `SecureKeyPlugin` and the React `Auth` page to decide whether to show the biometric button.

## Source Anchors

- `BiometricAuthHelper.kt` — `/android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelper.kt`
- Master key — `/android/app/src/main/java/com/kiyo/app/securekey/SecureKeyManager.kt`
- Plugin — `/android/app/src/main/java/com/kiyo/app/securekey/SecureKeyPlugin.kt`
- React consumer — `/src/pages/Auth.tsx`