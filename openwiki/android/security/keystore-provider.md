---
type: android-component
title: KeystoreProvider
description: Interface abstraction over the keystore implementation for dependency injection in tests.
tags: [android, keystore, interface, di]
---

# KeystoreProvider

`/android/app/src/main/java/com/kiyo/app/security/KeystoreProvider.kt` defines the abstraction that `KeystoreManager` implements.

## Interface

```kotlin
interface KeystoreProvider {
    fun getOrCreateKey(): SecretKey
    fun encrypt(masterKey: SecretKey, plainKey: ByteArray): EncryptedKey
    fun decrypt(masterKey: SecretKey, encrypted: EncryptedKey): ByteArray
    fun hasKey(alias: String): Boolean
    fun deleteKey(alias: String): Boolean
    fun needsSecurityUpgrade(currentAlias: String): Boolean
    fun isSecurityDowngrade(currentAlias: String): Boolean
}
```

## Implementations

- `KeystoreManager : KeystoreProvider` — production implementation backed by `AndroidKeyStore`.

No mock or fake is shipped in the project, but the interface allows tests to inject a fake Keystore by replacing the singleton via `KeystoreManager` reference substitution. The Robolectric tests in `KeystoreManagerTest.kt` exercise the production implementation against Robolectric's shadow Keystore.

## When the Interface Matters

The interface is mostly a forward-looking abstraction. Today `DatabaseKeyManager` calls `KeystoreManager` directly. The interface documents the contract that any alternate implementation (e.g., a Hardware-Backed Keystore via `StrongBox`) would need to satisfy.

## Source Anchors

- `KeystoreProvider.kt` — `/android/app/src/main/java/com/kiyo/app/security/KeystoreProvider.kt`
- Implementation — `/android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt`