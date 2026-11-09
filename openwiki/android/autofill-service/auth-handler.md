---
type: android-component
title: Autofill Auth Activity
description: DEVICE_CREDENTIAL/PIN prompt activity triggered when KiyoAutofillService hits UserNotAuthenticatedException.
tags: [android, autofill, auth, pin, device-credential]
---

# Autofill Authentication Activity

`/android/app/src/main/java/com/kiyo/app/autofill/auth/AutofillAuthActivity.kt` is the in-app screen that handles device-credential (PIN/pattern/password) confirmation when the autofill service needs access to the auth-required `DB_KEY` in Keystore.

## When it is launched

When `KiyoAutofillService.onFillRequest` calls `DatabaseKeyManager.getKey` and the user has not authenticated within the Keystore cache window (default 30 minutes), Android throws `android.security.keystore.UserNotAuthenticatedException`. Rather than crashing or silently failing, `KiyoAutofillService` returns an auth response via `FillResponseBuilder.createAuthResponse`:

```kotlin
val response = FillResponseBuilder.createAuthResponse(
    this@KiyoAutofillService,
    usernameId,
    passwordId
)
```

The system displays a chooser card; selecting KIYO launches `AutofillAuthActivity` with the `Theme.Kiyo.AutofillAuth` theme.

## Behavior

The activity is a thin wrapper around the system `KeyguardManager.createConfirmDeviceCredentialIntent` flow:

1. Build the credential confirmation intent via `KeyguardManager`.
2. Launch it via `ActivityResultLauncher`.
3. On success, dismiss the activity — the system resumes the autofill flow with a fresh `onFillRequest` that succeeds because the user's auth cache is now primed for 30 minutes.
4. On failure or cancel, dismiss without confirmation; the autofill request returns an empty result.

## Theme

```xml
android:theme="@style/Theme.Kiyo.AutofillAuth"
```

The dedicated theme prevents flashing during the credential prompt and matches the autofill service context.

## Manifest

```xml
<activity
    android:name=".autofill.auth.AutofillAuthActivity"
    android:exported="false"
    android:theme="@style/Theme.Kiyo.AutofillAuth" />
```

`exported="false"` because the activity is only launched by the autofill service within the app process.

## Differences from Biometric Vault Unlock

`AutofillAuthActivity` is for **device credential** (PIN/pattern/password) only and is launched by the **Android Autofill Framework** as part of an `onFillRequest` flow. It is distinct from:

- `KiyoBiometricActivity` — legacy/separate broadcast-based biometric prompt (not used in the current vault-unlock path).
- `BiometricAuthHelper` — the modern non-CryptoObject biometric prompt used by `SecureKeyPlugin` for React biometric vault unlock.

## Source Anchors

- `AutofillAuthActivity.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/auth/AutofillAuthActivity.kt`
- Manifest entry — `/android/app/src/main/AndroidManifest.xml`
- Trigger site — `/android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt` (`onFillRequest` auth-response branch)
- `FillResponseBuilder` — `/android/app/src/main/java/com/kiyo/app/autofill/response/FillResponseBuilder.kt`