---
type: page
title: AutofillTestLogin Page
description: Standalone login form inside the React WebView that exposes native autofill for manual and E2E testing.
tags: [page, autofill, test, e2e]
---
# AutofillTestLogin Page
Source File: /src/pages/AutofillTestLogin.tsx
Route: /autofill-test
Responsibility
Renders a minimal HTML form (username, password, submit) inside the React WebView so the native Android AutofillService can detect it as a login form and offer suggestions. This page exists for manual testing on a real device/emulator and for the native E2E test (AutofillE2ETest) to fill without depending on a third-party app.
Implementation
- Plain `<input>` elements (no React hooks around the form state) so AutofillService can read `AssistStructure` cleanly.
- A "Submit" button that just logs to the console (no real backend).
Why a WebView Form
The native AutofillService can fill any focused field in the active window — including the WebView. By hosting the test form inside the app's own WebView, the test no longer needs to install a separate "test host" Android app to fill against (although /android/autofill-test-host/ exists as a separate Gradle module for the autofill-test-host native E2E that fills against a non-WebView form).
Focused Tests
- src/pages/AutofillTestLogin.tsx is not heavily unit-tested; it is exercised by /android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt.
Source Anchors
- Page: /src/pages/AutofillTestLogin.tsx
- Native E2E: /android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt
- Test host module: /android/autofill-test-host/