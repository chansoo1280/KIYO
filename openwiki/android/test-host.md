---
type: android-component
title: Autofill Test Host
description: Separate Gradle module (autofill-test-host) that hosts the system autofill UI for native autofill E2E tests.
tags: [android, test-host, e2e, gradle-module]
---

# Autofill Test Host

`/android/autofill-test-host/` is a separate Gradle module that produces a minimal APK (`com.kiyo.autofilltest`) whose sole purpose is to expose login forms to the Android Autofill Framework so the KIYO autofill service can be tested end-to-end on an emulator or device.

## Purpose

The autofill service is invoked by the system Autofill Framework when an app declares autofillable fields. To exercise the service in an automated test, you need a third-party app that exposes those fields. Rather than depending on Google Chrome, Samsung Internet, or any external test fixture, KIYO ships its own minimal host app.

## Module Layout

```
android/autofill-test-host/
├── build.gradle
├── src/
│   └── main/
│       ├── AndroidManifest.xml
│       ├── java/com/kiyo/autofilltest/AutofillTestHostActivity.kt
│       └── res/
│           ├── layout/
│           └── values/
│               ├── strings.xml
│               └── themes.xml
└── settings.gradle (top-level Android module)
```

## Activity

`AutofillTestHostActivity` provides a simple layout with text inputs (username, password, optionally additional fields). When the KIYO autofill service is the active provider, focusing a field triggers `KiyoAutofillService.onFillRequest` against the test host activity's view structure.

The activity is registered with `android:exported="true"` and a `LAUNCHER` intent filter so it can be launched directly from `adb shell am start -n com.kiyo.autofilltest/.AutofillTestHostActivity` during E2E runs.

## Build Configuration

`build.gradle` declares the module as an `androidTest` companion that produces a debug APK alongside the main app. The CI scripts (`android/run-autofill-e2e.ps1`, `android/run-biometric-e2e.ps1`, `android/run-autosave-e2e.ps1`) install both APKs onto the emulator:

1. The main KIYO APK (`com.kiyo.app`).
2. The autofill-test-host APK (`com.kiyo.autofilltest`).

Both are needed because the test exercises a real cross-app autofill flow between `com.kiyo.autofilltest` (the requester) and `com.kiyo.app` (the service provider).

## Relationship to E2E Tests

The Android E2E suites (`AutofillE2E`, `AutosaveE2E`, `BiometricUnlockE2E`) and their page objects in `/android/app/src/androidTest/java/com/kiyo/app/e2e/` use the test host app as the source of autofillable fields. The PowerShell scripts orchestrate:

1. Build the main app APK.
2. Build the autofill-test-host APK.
3. Install both onto the emulator.
4. Enable KIYO as the autofill service via ADB.
5. Run the Espresso/`UiAutomator` test suite against the host app.
6. Capture logs to `android/run-autofill-e2e.log` (or similar).

The `npm run test:e2e:android:fast` and `:biometric:fast` scripts skip the build step via `-SkipBuild` when both APKs are already installed.

## Source Anchors

- `AutofillTestHostActivity.kt` — `/android/autofill-test-host/src/main/java/com/kiyo/autofilltest/AutofillTestHostActivity.kt`
- `build.gradle` — `/android/autofill-test-host/build.gradle`
- `AndroidManifest.xml` — `/android/autofill-test-host/src/main/AndroidManifest.xml`
- Run scripts — `/android/run-autofill-e2e.ps1`, `/android/run-biometric-e2e.ps1`, `/android/run-autosave-e2e.ps1`
- PowerShell invocation — `package.json` `scripts.test:e2e:android*`