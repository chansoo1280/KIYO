---
type: reference
title: Android Unit Tests
description: JUnit + Robolectric tests for the Kotlin autofill and security modules (DomainMatcher, FieldScorer, FieldScoringRules, AccountMapper, HtmlAttributeExtractor, KeystoreManager, DatabaseKeyManager, AutofillSyncManager, KiyoAutofillPlugin).
tags: [testing, android, junit, robolectric, kotlin]
---

# Android Unit Tests

`/android/app/src/test/java/com/kiyo/app/` runs JUnit + Robolectric against the Kotlin source. These tests are pure-JVM and do not require an emulator.

## Detection

- `autofill/detection/FieldScorerTest.kt` — `calculateUsernameScore` and `calculatePasswordScore` over a curated set of `AssistNode`-like test fixtures.
- `autofill/detection/FieldScoringRulesTest.kt` — `FieldScoringRules` (regex matching, hint hints, autofill hints).

## Repository

- `autofill/repository/DomainMatcherTest.kt` — exact + subdomain matching (e.g., `accounts.google.com` ↔ `google.com`).
- `autofill/repository/AccountMapperTest.kt` — `parseReactAccount` round-trip with realistic JSON.

## ViewNode

- `autofill/viewnode/HtmlAttributeExtractorTest.kt` — HTML attribute extraction from `AssistNode.webDomain` / `htmlAttributes`.

## Security

- `security/KeystoreManagerTest.kt` — alias-keyed keys, security upgrade/downgrade detection, encryption/decryption round-trip.
- `security/DatabaseKeyManagerTest.kt` — alias pointer migration, atomic rewrap rollback, KPInvalidated reset, AEADBadTag reset, 1-shot flag consumption.

## Capacitor Plugins

- `capacitor/AutofillSyncManagerTest.kt` — `SyncResult` data class, `AuthOutcome` state machine (Retried/AuthRequired), `handleAuthResult` retry flow.
- `capacitor/KiyoAutofillPluginTest.kt` — `isAutofillEnabled`, `syncAccountsFromReact`, `openAutofillSettings` smoke tests.

## Source Anchors

- Tests — `/android/app/src/test/java/com/kiyo/app/...`
- Build — `android/app/build.gradle` (testImplementation deps for Robolectric, MockK, Truth)