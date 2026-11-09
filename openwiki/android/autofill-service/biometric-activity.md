---
type: android-component
title: KiyoBiometricActivity
description: Legacy/separate broadcast-based biometric prompt activity (distinct from BiometricAuthHelper+SecureKeyPlugin vault unlock).
tags: [android, biometric, activity, broadcast]
---

# KiyoBiometricActivity

`/android/app/src/main/java/com/kiyo/app/autofill/biometric/KiyoBiometricActivity.kt` is a separate, broadcast-based biometric prompt activity. It is **not** used by the current vault-unlock path (which uses `BiometricAuthHelper` + `SecureKeyPlugin` with `BiometricPrompt` directly).

## Purpose (legacy)

The activity was originally designed as the host for a `BiometricPrompt` invocation that needed a `FragmentActivity` and broadcast back the result to a listener via `LocalBroadcastManager`. It remains in the codebase because it is registered in the manifest and consumed by code paths that may still reference it.

## Architecture

```kotlin
class KiyoBiometricActivity : FragmentActivity() {
    companion object {
        const val ACTION_BIOMETRIC_RESULT = "com.kiyo.app.autofill.BIOMETRIC_RESULT"
        const val EXTRA_SUCCESS = "success"
        const val EXTRA_ERROR_CODE = "error_code"
        const val EXTRA_ERROR_MESSAGE = "error_message"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Launch BiometricPrompt and broadcast result on completion
    }

    companion object {
        fun startBiometricAuth(
            context: Context,
            packageName: String,
            authReason: String
        ): Boolean {
            val intent = Intent(context, KiyoBiometricActivity::class.java).apply {
                putExtra("packageName", packageName)
                putExtra("authReason", authReason)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            return true
        }
    }
}
```

The activity:

1. Receives `packageName` + `authReason` via Intent extras.
2. Launches `BiometricPrompt` with `setAllowedAuthenticators(BIOMETRIC_STRONG)`.
3. On completion, broadcasts a `LocalBroadcastManager` event with `ACTION_BIOMETRIC_RESULT`.
4. Finishes itself.

## Manifest

```xml
<activity
    android:name=".autofill.KiyoBiometricActivity"
    android:exported="false"
    android:theme="@style/AppTheme.NoActionBar" />
```

`exported="false"` because it is only launched within the app process.

## Distinction from BiometricAuthHelper (modern path)

| Path | Component | Use case |
|------|-----------|----------|
| **Modern** | `BiometricAuthHelper` + `SecureKeyPlugin` | React vault biometric unlock via `BiometricPrompt` constructed directly with `FragmentActivity` from `MainActivity` (no separate Activity host) |
| **Legacy** | `KiyoBiometricActivity` | Self-contained broadcast-based prompt that requires its own Activity launch |

The modern path is documented in [`securekey/biometric-auth-helper.md`](../securekey/biometric-auth-helper.md) and [`securekey/biometric-auth-helper-factory.md`](../securekey/biometric-auth-helper-factory.md).

## Source Anchors

- `KiyoBiometricActivity.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/biometric/KiyoBiometricActivity.kt`
- Manifest entry — `/android/app/src/main/AndroidManifest.xml`
- Modern vault unlock — `/android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelper.kt`, `SecureKeyPlugin.kt`, `SecureKeyManager.kt`