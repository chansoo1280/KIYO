# Plan: Autofill Reliability Improvements (Track 1)

**Date:** 2026-08-24  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도

---

## Goal

When complete, the following should be true:

1. **Domain matching** — exact domain + subdomain matching works reliably for web autofill; package name matching works for native Android apps
2. **Field detection** — username/password field detection accuracy improved across common web sites (Google, Microsoft, GitHub, banking) and native apps
3. **Keystore auth cache/re-wrap integrity** — security upgrade (lockscreen added) and downgrade (lockscreen removed) flows verified; KPInvalidated recovery tested
4. **Authentication UX** — biometric prompt → PIN/pattern fallback flow works smoothly; no stale auth state
5. **Plugin interface** — `KiyoAutofillPlugin` responsibilities clarified; platform abstraction defined for future iOS expansion

---

## Current State

### Autofill Flow Overview

```
User opens login form (app/web)
       │
       ▼
Android triggers KiyoAutofillService.onFillRequest
       │
       ├── ViewNode traversal → FieldDetector → FieldScorer (username/password candidates)
       │
       ├── Package name extraction (ViewNode + activityComponent)
       │
       ├── Domain extraction (webDomain + HTML attributes)
       │
       ├── DatabaseKeyManager.getKey() → KeystoreManager.getOrCreateKey(alias)
       │       │
       │       ├── auth-required key + valid cache → returns SecretKey
       │       ├── auth-required key + expired cache → throws UserNotAuthenticatedException
       │       └── non-auth key → returns SecretKey
       │
       ├── AutofillRepository.findMatchingAccounts(domain) OR findByPackageName(pkg)
       │
       ├── FillResponseBuilder.createFillResponse(accounts, usernameId, passwordId)
       │
       └── callback.onSuccess(response)

If auth required:
    FillResponseBuilder.createAuthResponse() → auth dataset shown
    User taps → BiometricPrompt (PIN/pattern fallback)
    On success → re-request fill → actual accounts returned
```

### Key Components

| Component | Role | File |
|-----------|------|------|
| `KiyoAutofillService` | Main AutofillService entry point; per-request fresh repo | `autofill/service/KiyoAutofillService.kt` |
| `AuthRequestHandler` | Auth logic separation; DB_KEY access + response creation | `autofill/service/AuthRequestHandler.kt` |
| `DomainMatcher` | Domain matching (exact + parent subdomain) | `autofill/repository/DomainMatcher.kt` |
| `AccountMapper` | React JSON → AutofillAccount parsing | `autofill/repository/AccountMapper.kt` |
| `FieldDetector` | ViewNode traversal + best candidate selection | `autofill/detection/FieldDetector.kt` |
| `FieldScorer` | Username/password scoring rules | `autofill/detection/FieldScorer.kt` |
| `FieldScoringRules` | Scoring constants + validation helpers | `autofill/detection/FieldScoringRules.kt` |
| `KeystoreManager` | Master key gen/encrypt/decrypt (`kiyo_master_key_N`) | `security/KeystoreManager.kt` |
| `DatabaseKeyManager` | DB_KEY wrap/unwrap, alias pointer, re-wrap, reset | `security/DatabaseKeyManager.kt` |
| `KiyoAutofillPlugin` | React ↔ Native bridge (sync, status, enable, count) | `capacitor/KiyoAutofillPlugin.kt` |
| `FillResponseBuilder` | Dataset/auth response construction | `autofill/response/FillResponseBuilder.kt` |

### Existing Tests

| Test Type | Files |
|-----------|-------|
| Unit (JVM) | `DomainMatcherTest`, `AccountMapperTest`, `FieldScoringRulesTest`, `AuthRequestHandlerTest` |
| Android E2E | `AutofillE2ETest` (2 stages: noAuth → authRequired) |
| Integration | React unit tests (`fileStorage.encryption.integration.test.ts`, etc.) |

---

## Relevant Files

### Core Autofill (to modify)

```
android/app/src/main/java/com/kiyo/app/autofill/
├── service/
│   ├── KiyoAutofillService.kt        # Main service, per-request repo
│   └── AuthRequestHandler.kt          # Auth logic
├── repository/
│   ├── DomainMatcher.kt               # Domain matching logic ← IMPROVE
│   ├── AccountMapper.kt               # JSON parsing ← IMPROVE
│   └── AutofillRepository.kt          # Sync + CRUD
├── detection/
│   ├── FieldDetector.kt               # Traversal
│   ├── FieldScorer.kt                 # Scoring ← IMPROVE
│   └── FieldScoringRules.kt           # Rules/constants ← IMPROVE
├── viewnode/
│   ├── ViewNodePredicate.kt           # HTML attribute helpers
│   └── HtmlAttributeExtractor.kt
├── response/
│   └── FillResponseBuilder.kt         # Response creation
├── credential/
│   └── CredentialExtractor.kt
└── icon/
    └── IconResourceMapper.kt
```

### Security (to verify/test)

```
android/app/src/main/java/com/kiyo/app/security/
├── KeystoreManager.kt                 # Master key management
├── DatabaseKeyManager.kt              # DB_KEY wrap/unwrap/re-wrap/reset
├── KeystoreProvider.kt                # Interface
└── DatabaseKeyGenerator.kt
```

### Plugin Bridge (to clarify/abstract)

```
android/app/src/main/java/com/kiyo/app/capacitor/
└── KiyoAutofillPlugin.kt              # React ↔ Native bridge
```

### E2E Tests (to extend)

```
android/app/src/androidTest/java/com/kiyo/app/autofill/
├── AutofillE2ETest.kt                 # Main E2E test
├── testutil/
│   ├── AutofillTestHost.kt            # Test host control
│   ├── WebViewTestHelper.kt
│   └── TestSecurityInitializer.kt
└── pageobjects/
    ├── HomePage.kt
    ├── AccountsPage.kt
    ├── AccountEditPage.kt
    ├── SettingsPage.kt
    └── BasePage.kt
```

### React Side (for sync data format)

```
src/
├── plugins/kiyautofill.ts              # TS interface
├── pages/Settings/components/AutofillSection.tsx  # UI
├── store/accountStore.ts               # Account data source
└── store/sessionStore.ts               # Sync metadata
```

---

## Architecture

### Data Flow: Sync (React → Native)

```
React (accountStore.accounts)
       │
       ▼
JSON.stringify(accounts) → KiyoAutofill.syncAccountsFromReact({accountsJson})
       │
       ▼
KiyoAutofillPlugin.syncAccountsFromReact()
       │
       ├── DatabaseKeyManager.getCurrentAlias() → check securityDowngrade
       │       └── if downgrade: resetAutofillData() → fresh key
       │
       ├── DatabaseKeyManager.getKey() → KeystoreManager.getOrCreateKey()
       │       └── auth-required? → UserNotAuthenticatedException → pendingSync + authActivity
       │
       ├── ensureRepositoryInitialized() → AutofillRepository.create(context, dbKey)
       │
       ├── DatabaseKeyManager.wasSecurityUpgraded() → include in response
       │
       └── repository.syncAccountsFromReact(accountsJson)
               │
               ├── DELETE all existing accounts
               │
               └── FOR each React account:
                       AccountMapper.parseReactAccount() → AutofillAccount
                       INSERT with packageNames JSON array
```

### Data Flow: Fill Request

```
Android System → onFillRequest(FillRequest)
       │
       ├── ViewNodeExtractor.extractPackageNames() + activityComponent.packageName
       ├── ViewNodeExtractor.extractDomainFromStructure() (webDomain + HTML attrs)
       ├── FieldDetector.findBestFieldCandidate(username/password)
       │
       ├── openRepository() → DatabaseKeyManager.getKey() → KeystoreManager.getOrCreateKey()
       │       └── throws UserNotAuthenticatedException if auth needed
       │
       ├── repo.findMatchingAccounts(domain) OR findByPackageName(pkg)
       │
       └── FillResponseBuilder.createFillResponse() OR createAuthResponse()
```

### Key Security Boundaries

| Boundary | Description |
|----------|-------------|
| **Process** | AutofillService runs in separate process from MainActivity |
| **Keystore** | `kiyo_master_key_N` (autofill) vs `kiyo_secure_master_key` (biometric vault) — completely separate |
| **Auth Cache** | 30 min (release) / 30 sec (debug); per-process, survives service restart |
| **DB_KEY** | 32-byte AES key, wrapped by Keystore master key, stored in DataStore (`kiyo_security_prefs`) |
| **Alias Pointer** | `current_master_key_alias` in DataStore points to active Keystore alias; atomic re-wrap commits both blob + pointer |

---

## Proposed Changes

### 1. DomainMatcher Improvements

| File | Component | Change | Reason |
|------|-----------|--------|--------|
| `DomainMatcher.kt` | `findMatchingAccounts` | Add support for wildcard subdomain matching (`*.example.com`) | Some sites use wildcard subdomains; current parent-domain-only misses these |
| `DomainMatcher.kt` | `findByPackageName` | Add exact package name match + prefix match for app families | Package names like `com.example.app` and `com.example.app.beta` should match same account |
| `DomainMatcher.kt` | `findMatchingAccounts` | Normalize domain (lowercase, strip www., strip port) before matching | Case/port differences cause missed matches |
| `DomainMatcher.kt` | New method | `findBestMatch(domain, packageNames)` — unified match scoring | Single entry point for both web + native matching with confidence score |

### 2. AccountMapper Improvements

| File | Component | Change | Reason |
|------|-----------|--------|--------|
| `AccountMapper.kt` | `parseReactAccount` | Extract domain from `websiteUrl` more robustly (handle no-scheme, paths, query) | Current `extractDomain` fails on `example.com/login` without scheme |
| `AccountMapper.kt` | `parseReactAccount` | Support multiple `packageNames` from React account fields | Some apps have multiple package names (flavors, beta, etc.) |
| `AccountMapper.kt` | `fromCursor` | Add validation for required fields (username, password non-empty) | Prevent corrupt DB entries from breaking autofill |

### 3. FieldScorer / FieldScoringRules Improvements

| File | Component | Change | Reason |
|------|-----------|--------|--------|
| `FieldScoringRules.kt` | `isValidInputField` | Fix WebView TODO: allow WebView internal nodes with proper autofillHints | WebView in Samsung Internet, Chrome Custom Tabs not detected |
| `FieldScoringRules.kt` | Constants | Tune scores: increase HTML autocomplete weight, decrease fallback | Reduce false positives on non-login forms |
| `FieldScorer.kt` | `calculateUsernameScore` | Add `htmlAutocomplete=one-time-code` as negative signal (OTP fields) | OTP fields incorrectly matched as username |
| `FieldScorer.kt` | `calculatePasswordScore` | Add `htmlAutocomplete=new-password` handling for registration forms | Distinguish login vs registration |
| `FieldScorer.kt` | Both | Log candidate details with structured format for debugging | Easier log analysis for tuning |

### 4. Keystore Auth Flow Edge Case Coverage (Tests)

> **Note**: `AuthRequestHandlerTest` (6 tests) already covers baseline auth flow (success, auth required, package fallback, error handling). The following edge cases are covered in **NEW test files** and **E2E tests**:

| File | Coverage |
|------|----------|
| `DatabaseKeyManagerTest.kt` (NEW) | `isSecurityDowngrade` (lockscreen removed), `resetAutofillData`, KPInvalidated simulation |
| `KeystoreManagerTest.kt` (NEW) | `needsSecurityUpgrade` (lockscreen added), key lifecycle |
| `AutofillE2ETest.kt` (NEW tests) | `autofillAfterProcessDeath_authCacheValid`, `autofillSecurityDowngrade_lockscreenRemoved` |

### 5. Plugin Interface Clarification

| File | Component | Change | Reason |
|------|-----------|--------|--------|
| `KiyoAutofillPlugin.kt` | `syncAccountsFromReact` | Extract sync logic to `AutofillSyncManager` class | Single responsibility; testable without Capacitor |
| `KiyoAutofillPlugin.kt` | New interface | Define `AutofillPlatformBridge` interface for platform abstraction | Enable iOS Password AutoFill plugin with same React API |
| `kiyautofill.ts` | Types | Add `AutofillPlatformBridge` type definition | Shared contract between platforms |

### 6. FillResponseBuilder — SaveInfo (Optional, Low Priority)

| File | Component | Change | Reason |
|------|-----------|--------|--------|
| `FillResponseBuilder.kt` | `createFillResponse` | Implement SaveInfo for system save dialog (currently TODO) | Proper Android Autofill UX; currently suppressed for E2E |

---

## Tests

### Unit Tests (JVM) — **NEW FILES ONLY + MINIMAL ADDITIONS**

| Test File | Status | Scenarios to Add |
|-----------|--------|------------------|
| `DatabaseKeyManagerTest.kt` | **NEW FILE** | `isSecurityDowngrade` (lockscreen removed → true, present → false), `resetAutofillData` (full reset: keystore + DataStore + DB file), KPInvalidated recovery simulation |
| `KeystoreManagerTest.kt` | **NEW FILE** | `needsSecurityUpgrade` (lockscreen added + non-auth key → true), `isSecurityDowngrade`, key gen/delete lifecycle |
| `FieldScorerTest.kt` | **NEW FILE** | `calculateUsernameScore` (autofillHints, HTML autocomplete/type, **OTP negative signal**), `calculatePasswordScore` (autofillHints, HTML autocomplete/type, **new-password handling**) |

| Existing Test File | Additions Only (Already Covered → Remove from Plan) |
|--------------------|------------------------------------------------------|
| `DomainMatcherTest` | +5: parent domain (a.b.c.com→b.c.com), wildcard `*.example.com`, case/port normalization, prefix package match (`com.app`/`com.app.beta`), `findBestMatch` unified scoring |
| `AccountMapperTest` | +3: no-scheme URL (`example.com/path`), multiple `packageNames` array, `fromCursor` validation (username/password non-empty) |
| `FieldScoringRulesTest` | +3: WebView internal nodes with username/password autofillHints (replace TODO), OTP `one-time-code` negative signal, `new-password` registration form signal |

> **Note**: `DomainMatcherTest` (21 tests), `AccountMapperTest` (17 tests), `FieldScoringRulesTest` (18 tests), `AuthRequestHandlerTest` (6 tests) already cover most baseline scenarios. Only **additions above** are needed.

### Android Instrumentation Tests

| Test | Target | Scenario |
|------|--------|----------|
| `AutofillE2ETest` | `autofillEnableSyncAndFill_unencryptedVault_noAuth` | Existing — baseline |
| `AutofillE2ETest` | `resyncAfterDeviceCredentialAdded_authRequired` | Existing — baseline |
| `AutofillE2ETest` | **NEW** `autofillAfterProcessDeath_authCacheValid` | Kill service process, immediate fill → should use cached auth (no prompt) |
| `AutofillE2ETest` | **NEW** `autofillSecurityDowngrade_lockscreenRemoved` | Add PIN → sync → remove PIN → sync → should reset + rebuild |
| `AutofillE2ETest` | **NEW** `autofillMultiplePackageNames` | Account with packageNames=[com.app, com.app.beta] → fill works for both |
| `AutofillE2ETest` | **NEW** `autofillWildcardSubdomain` | Account domain=*.example.com → fill works for api.example.com, app.example.com |

### E2E Manual Verification

| Scenario | Steps | Expected |
|----------|-------|----------|
| Google login (split screens) | Navigate to accounts.google.com → username screen → password screen | Both screens autofill correctly |
| Samsung Internet | Open site in Samsung Internet → trigger autofill | Fields detected via WebView internal nodes |
| Banking app | Open banking app login → trigger autofill | Package name match works |
| Biometric → PIN fallback | Register biometric → auth prompt → cancel → PIN entry | Fallback works smoothly |
| Lockscreen toggle | Enable lockscreen → sync (upgrade) → fill after 35s → disable lockscreen → sync (downgrade) | Both upgrade/downgrade handled |

---

## Risks

### Security Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Weakened domain matching → wrong account filled | Credential leakage | Add confidence threshold; log all matches; prefer exact domain |
| KPInvalidated recovery creates new DB_KEY without user awareness | Silent data reset | Current design: reset + sync rebuild (derived data) — acceptable per STRATEGY.md |
| Auth cache too long in release (30 min) | Stale auth after PIN change | Debug 30s for testing; release 30min is Android standard |
| Plugin interface exposes DB_KEY | Key leakage | Bridge only passes account JSON; keys never cross boundary |

### Regression Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| DomainMatcher changes break existing matches | Autofill stops working for some sites | Comprehensive unit tests + E2E with known sites |
| FieldScorer tuning causes false positives/negatives | Wrong fields filled or no fill | Log candidate scores in debug; manual verification on top sites |
| Package name matching changes | Native app autofill breaks | Test with testHost + known package names |

### Lifecycle Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| AutofillService process death → repo recreation | Per-request fresh repo handles this (v3 design) | Verify in E2E: process death + immediate fill |
| MainActivity destroyed during auth → pendingSync lost | Sync fails silently | Plugin uses ActivityResultLauncher; survives recreation |
| WebView reload loses autofill context | Fill request fails | Field detection runs fresh per request |

### Compatibility Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Android API level differences (Autofill API) | Crashes on older API | Min API 26; use version checks |
| SQLCipher version mismatch | DB corruption | Pin SQLCipher version in Gradle |
| Capacitor plugin API changes | Bridge breaks | Version plugin interface; test with `npx cap sync` |

### Migration Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing autofill DB schema changes | Upgrade fails | Room/SQLCipher migration not used (DB recreated on reset) |
| Alias pointer migration (legacy → indexed) | Key loss | DatabaseKeyManager.resolveCurrentAlias handles legacy adoption |

---

## Rollback

### Code Rollback

```bash
# Revert to main branch
git checkout master
git branch -D feature/autofill-reliability
```

### Data Rollback (if deployed)

| Scenario | Rollback Action |
|----------|-----------------|
| Autofill DB corruption | `DatabaseKeyManager.resetAutofillData(context)` → next sync rebuilds |
| Keystore alias mismatch | Delete all `kiyo_master_key_*` aliases → fresh key generated on next getKey() |
| Plugin interface breaking change | React side handles missing fields gracefully (optional chaining) |
| Domain matching regression | Disable new matching logic via feature flag (add to settings) |

### Verification Before Merge

1. `npm run check` passes (typecheck + all unit tests)
2. `npm run test:e2e:android` passes both stages
3. Manual verification on: Google, GitHub, Microsoft, Samsung Internet, 2 banking apps
4. Lockscreen toggle cycle (add PIN → sync → fill → remove PIN → sync → fill)

---

## Verification Criteria

Plan is implementation-ready when:

- [x] All affected files identified
- [x] Architecture documented with data flows and security boundaries
- [x] Each change has file/component/reason
- [x] Unit test scenarios defined for each component
- [x] Android E2E test scenarios defined
- [x] Security/lifecycle/compatibility risks documented with mitigations
- [x] Rollback strategy defined for code and data
- [x] Another engineer could implement without rediscovering architecture

---

## Implementation Order (Recommended)

1. **DomainMatcher + AccountMapper** (matching accuracy — highest user impact)
2. **FieldScorer + FieldScoringRules** (detection quality — WebView TODO)
3. **NEW Unit Test Files** (stability — `DatabaseKeyManagerTest`, `KeystoreManagerTest`, `FieldScorerTest`)
4. **Plugin Interface Extraction** (architecture — low risk, enables future)
5. **E2E Test Expansion** (confidence — 4 new scenarios)
6. **SaveInfo Implementation** (polish — optional)

---

## Main Risks Summary

| Priority | Risk | Likelihood | Impact |
|----------|------|------------|--------|
| P0 | Domain matching regression on existing sites | Medium | High |
| P0 | KPInvalidated not handled → autofill permanently broken | Low | Critical |
| P1 | FieldScorer tuning causes false positives | Medium | Medium |
| P1 | Auth cache expiry UX (35s wait in debug) | High (debug only) | Low |
| P2 | Plugin interface abstraction over-engineering | Low | Low |

---

## Can Implementation Begin?

**Yes** — the plan is complete and implementation-ready. All architecture, file changes, tests, risks, and rollback are documented. Another competent engineer could implement this without rediscovering the codebase.

**Next step:** Begin with Phase 1 (DomainMatcher + AccountMapper) using `ce-work` or direct implementation.