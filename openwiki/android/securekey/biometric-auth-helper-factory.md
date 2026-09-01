---
type: android-component
title: BiometricAuthHelperFactory
description: DI seam for constructing BiometricAuthHelper with the Capacitor Plugin's FragmentActivity.
tags: [android, di, factory, biometric]
---

# BiometricAuthHelperFactory

`/android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelperFactory.kt` is the dependency-injection seam used by `SecureKeyPlugin` to construct a `BiometricAuthHelper` bound to the current `FragmentActivity`.

## API

```kotlin
object BiometricAuthHelperFactory {
    fun create(context: Context, activity: FragmentActivity): BiometricAuthHelper
}
```

## Why a Factory

`BiometricAuthHelper` requires both a `Context` (for `SharedPreferences` access) and a `FragmentActivity` (for `BiometricPrompt`). The activity must be the current foreground activity so the biometric prompt has a window to attach to.

`SecureKeyPlugin` is a `Plugin` and has access to `context` and `activity` (the host activity, which extends `FragmentActivity` via `BridgeActivity` / `BridgeFragmentActivity`):

```kotlin
val helper = BiometricAuthHelperFactory.create(context, activity as FragmentActivity)
```

## Mocking in Tests

`BiometricAuthHelperFactory` is an `object`, so tests cannot substitute a mock via constructor injection. The Robolectric tests substitute by using a real `Robolectric.buildActivity` to host a `FragmentActivity` for the helper, then assert on its callbacks. The factory abstraction exists primarily for documentation — a future PR could turn it into an interface for cleaner mocking.

## Source Anchors

- `BiometricAuthHelperFactory.kt` — `/android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelperFactory.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/securekey/SecureKeyPlugin.kt`