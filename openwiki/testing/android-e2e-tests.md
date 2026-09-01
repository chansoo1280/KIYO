---
type: reference
title: Android E2E Tests
description: androidx.test E2E suites for autofill, autosave, and biometric unlock. Page objects and helpers for emulator-driven testing.
tags: [testing, android, e2e, androidx, page-object]
---

# Android E2E Tests

`/android/app/src/androidTest/java/com/kiyo/app/` runs `connectedAndroidTest` against a real emulator. The suite exercises three flows:

1. `autofill/AutofillE2ETest.kt` — AutofillE2E (KIYO app + AutofillTestHost).
2. `autosave/AutosaveE2ETest.kt` — AutosaveE2E.
3. `biometric/BiometricUnlockE2ETest.kt` — BiometricUnlockE2E.

## Page Objects

`/android/app/src/androidTest/java/com/kiyo/app/e2e/pageobjects/` contains the page-object model:

- `BasePage.kt` — common actions (tap, type, find by id/text).
- `HomePage.kt`, `CreateVaultPage.kt`, `AuthPage.kt`, `AccountsPage.kt`, `AccountCreatePage.kt`, `AccountEditPage.kt`, `SettingsPage.kt`, `AutofillLoginPage.kt`, `TemplatePickerDialog.kt`.

## Test Helpers

`/android/app/src/androidTest/java/com/kiyo/app/e2e/testutil/` contains:

- `E2EEnv.kt` — shared constants and URL paths.
- `DeviceOpsHelper.kt` — emulator-side ops (set clipboard, register fingerprint, etc.).
- `NativeAuthPromptHandler.kt` — handles Android Keystore auth prompts during autofill.
- `TestDataFactory.kt` — fixture builder for `KiyoVaultData`/`AutofillAccount`.
- `TestSecurityInitializer.kt` — primes the Keystore master keys for the test session.
- `WebViewTestHelper.kt` — WebView debugging (evaluate JS, screenshot).

## Run Scripts

```bash
npm run test:e2e:android             # AutofillE2E full build + run
npm run test:e2e:android:fast        # AutofillE2E reuse APK
npm run test:e2e:biometric           # Biometric full build + run
npm run test:e2e:biometric:fast      # Biometric reuse APK
npm run test:e2e:autosave            # Autosave full build + run
npm run test:e2e:autosave:fast       # Autosave reuse APK
```

The `fast` variants skip the build step (assumes APK + biometric registration from previous run). The PowerShell scripts at `/android/run-autofill-e2e.ps1`, `/android/run-biometric-e2e.ps1`, `/android/run-autosave-e2e.ps1` orchestrate the build + run.

## Autofill Test Host Module

The `/android/autofill-test-host/` Gradle module provides a separate APK (`com.kiyo.autofilltest`) that hosts a simple login form. The autofill service fills the form during the E2E. This module is documented at [Android Test Host](/openwiki/android/test-host.md).

## Source Anchors

- Tests — `/android/app/src/androidTest/java/com/kiyo/app/...`
- Helpers — `/android/app/src/androidTest/java/com/kiyo/app/e2e/...`
- Scripts — `/android/run-autofill-e2e.ps1`, `/android/run-biometric-e2e.ps1`, `/android/run-autosave-e2e.ps1`
- Test host — `/android/autofill-test-host/`