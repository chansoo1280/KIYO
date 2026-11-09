---
type: android-component
title: SecureKeyPlugin (Native)
description: Capacitor plugin for biometric vault unlock. Includes storeKey, unlockKeyWithBiometric, hasKey, deleteKey.
tags: [android, capacitor, biometric, securekey]
---

# SecureKeyPlugin

`/android/app/src/main/java/com/kiyo/app/securekey/SecureKeyPlugin.kt` is the native implementation of the `SecureKey` Capacitor plugin (declared at `/src/plugins/kiyosecurekey.ts`).

## Plugin Shape

```kotlin
@CapacitorPlugin(name = "SecureKey")
class SecureKeyPlugin : Plugin() {
    // ...
}
```

## Methods

### storeKey

```kotlin
@PluginMethod
fun storeKey(call: PluginCall) {
    val vaultId = call.getString("vaultId") ?: return call.reject("vaultId required")
    val cryptoKeyBase64 = call.getString("cryptoKeyBase64") ?: return call.reject("cryptoKeyBase64 required")
    GlobalScope.launch(Dispatchers.IO) {
        val helper = BiometricAuthHelperFactory.create(context, activity as FragmentActivity)
        val result = helper.storeKey(vaultId, cryptoKeyBase64)
        // ...
    }
}
```

Wraps the React `cryptoKey` (base64 of AES-GCM key bytes) under `kiyo_secure_master_key` after biometric authentication. See [Biometric Auth Helper](../securekey/biometric-auth-helper.md) for the actual cipher flow.

### unlockKeyWithBiometric

```kotlin
@PluginMethod
fun unlockKeyWithBiometric(call: PluginCall) {
    val vaultId = call.getString("vaultId") ?: return call.reject("vaultId required")
    GlobalScope.launch(Dispatchers.IO) {
        val helper = BiometricAuthHelperFactory.create(context, activity as FragmentActivity)
        val result = helper.unlockKeyWithBiometric(vaultId)
        result.fold(
            onSuccess = { key -> call.resolve(JSObject().apply { put("key", key) }) },
            onFailure = { err ->
                val corrupted = err is BiometricAuthHelper.BiometricKeyCorruptedException
                call.reject(err.message ?: "Unknown error", if (corrupted) "KEY_CORRUPTED" else null, err)
            }
        )
    }
}
```

Returns the base64-encoded raw cryptoKey bytes. The React side (`pages/Auth.tsx`) then calls `useSessionStore.getState().setCryptoKeyFromBase64(key, salt)` followed by `initializeStores()`.

The `KEY_CORRUPTED` error code is propagated via the Capacitor reject payload (`err.data?.keyCorrupted`) so the UI can surface a "re-enroll biometric" message.

### hasKey / deleteKey

```kotlin
@PluginMethod
fun hasKey(call: PluginCall) { /* ... */ }
@PluginMethod
fun deleteKey(call: PluginCall) { /* ... */ }
```

Convenience methods used by `Auth.tsx` to decide whether to show the biometric button.

## BiometricAuthHelperFactory

```kotlin
val helper = BiometricAuthHelperFactory.create(context, activity as FragmentActivity)
```

DI seam used by `SecureKeyPlugin` to construct the helper. In production it returns a real `BiometricAuthHelper`; tests substitute a mock via this factory. See [Biometric Auth Helper Factory](../securekey/biometric-auth-helper-factory.md).

## Source Anchors

- `SecureKeyPlugin.kt` — `/android/app/src/main/java/com/kiyo/app/securekey/SecureKeyPlugin.kt`
- Helper — `/android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelper.kt`
- Factory — `/android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelperFactory.kt`
- Web stub — `/src/plugins/kiyosecurekey.ts`, `/src/plugins/kiyosecurekey.web.ts`