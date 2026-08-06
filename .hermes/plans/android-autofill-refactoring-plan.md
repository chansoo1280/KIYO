# Android Autofill Service Refactoring Plan

## Current State Analysis

### Files in `android/app/src/main/java/com/kiyo/app/autofill/` (12 files)
| File | Lines | Purpose |
|------|-------|---------|
| `KiyoAutofillService.kt` | 462 | Main AutofillService implementation |
| `AutofillRepository.kt` | 792 | SQLite/SQLCipher repository for accounts |
| `AutofillDataStore.kt` | 119 | Preferences DataStore for autofill session tokens |
| `AutofillDataStoreJavaBridge.kt` | 86 | Java bridge for DataStore suspend functions |
| `AutofillDatabaseHelper.kt` | 159 | SQLCipher database helper |
| `FieldDetector.kt` | 102 | Field detection orchestrator |
| `FieldScorer.kt` | ~500 | Username/password field scoring logic |
| `FieldCandidate.kt` | 20 | Data class for field candidates |
| `FillResponseBuilder.kt` | 133 | FillResponse dataset creation |
| `ViewNodeUtils.kt` | 367 | ViewNode traversal, HTML extraction, utilities |
| `CredentialExtractor.kt` | 49 | Credential extraction from ViewNode |
| `IconResourceMapper.kt` | 88 | Site icon resource mapping |
| `KiyoBiometricActivity.kt` | 219 | Biometric authentication activity |
| `AutofillSettingsActivity.kt` | 9 | Empty settings activity placeholder |

### Related Files
| File | Purpose |
|------|---------|
| `capacitor/KiyoAutofillPlugin.java` | Capacitor bridge (609 lines) |
| `security/DatabaseKeyManager.kt` | DB_KEY encryption via Keystore |
| `security/KeystoreManager.kt` | Keystore master key operations |
| `security/DatabaseKeyGenerator.kt` | Random DB_KEY generation |
| `security/EncryptedKey.kt` | Encrypted key serialization |

---

## Phase 0: Baseline Freeze (Prerequisite)

**Goal**: Document current working behavior before any changes

### Checklist
- [ ] `./gradlew assembleDebug` — build passes
- [ ] Autofill in Chrome (web form) — username/password fill works
- [ ] Autofill in native Android app — username/password fill works
- [ ] Save credentials — new account saved to autofill DB
- [ ] Update credentials — existing account updated
- [ ] Delete credentials — account removed
- [ ] Unlock with PIN — autofill works after unlock
- [ ] Biometric OFF — PIN unlock works
- [ ] Biometric ON — fingerprint/face unlock works
- [ ] App process killed & restarted — session token persists (30 min)
- [ ] Token expiry — auth requested after 30 min

> **Note**: Run this checklist after EVERY phase to catch regressions immediately.

---

## Phase 1: Eliminate Code Duplication (High Impact, Low Risk)

**Goal**: Remove 200+ lines of duplicated traversal code in `KiyoAutofillService`

### Actions
| Action | Files Affected |
|--------|----------------|
| Delete `extractDomainFromStructure` (lines 360-374) from `KiyoAutofillService` | `KiyoAutofillService.kt` |
| Delete `extractPackageNamesFromStructure` (lines 379-391) from `KiyoAutofillService` | `KiyoAutofillService.kt` |
| Delete `extractAppNameFromStructure` (lines 396-410) from `KiyoAutofillService` | `KiyoAutofillService.kt` |
| Delete `extractTitleFromStructure` (lines 415-440) from `KiyoAutofillService` | `KiyoAutofillService.kt` |
| Use `ViewNodeUtils` equivalents instead | `KiyoAutofillService.kt` |
| Delete private `extractCredentialsFromFields` from `KiyoAutofillService` (use `CredentialExtractor`) | `KiyoAutofillService.kt` |

### Verification
- Build passes
- Phase 0 checklist passes

---

## Phase 2: Package Reorganization Only (Medium Impact, Low Risk)

**Goal**: Move files into sub-packages. **No class extraction, no merging, no logic changes.**

### New Package Structure (after move)
```
autofill/
  ├── service/
  │   └── KiyoAutofillService.kt
  │
  ├── repository/
  │   ├── AutofillRepository.kt
  │   └── AutofillDatabaseHelper.kt
  │
  ├── session/
  │   ├── AutofillDataStore.kt           # rename: AutofillSessionStore.kt
  │   └── AutofillDataStoreJavaBridge.kt # rename: AutofillSessionStoreBridge.kt
  │
  ├── detection/
  │   ├── FieldDetector.kt
  │   ├── FieldScorer.kt
  │   └── FieldCandidate.kt
  │
  ├── response/
  │   └── FillResponseBuilder.kt
  │
  ├── viewnode/
  │   └── ViewNodeUtils.kt               # KEEP AS-IS for now
  │
  ├── credential/
  │   └── CredentialExtractor.kt
  │
  ├── icon/
  │   └── IconResourceMapper.kt
  │
  ├── biometric/
  │   └── KiyoBiometricActivity.kt
  │
  └── settings/
      └── AutofillSettingsActivity.kt
```

### Actions
| Action | Details |
|--------|---------|
| Create sub-packages | `service`, `repository`, `session`, `detection`, `response`, `viewnode`, `credential`, `icon`, `biometric`, `settings` |
| Move files to new packages | Update `package` declarations and all imports |
| Rename `AutofillDataStore` → `AutofillSessionStore` | Name only, no logic change |
| Rename `AutofillDataStoreJavaBridge` → `AutofillSessionStoreBridge` | Name only, no logic change |

### Verification
- Build passes
- Phase 0 checklist passes
- Diff is mostly import statements — easy to review

---

## Phase 3: Responsibility Separation (Medium Impact, Medium Risk)

**Goal**: Extract cohesive responsibilities into dedicated classes. **No async/structural changes yet.**

### Extractions
| New Class | Source | Responsibility |
|-----------|--------|----------------|
| `AuthRequestHandler` | `KiyoAutofillService` | Token validation, auth intent creation |
| `DatasetFactory` | `FillResponseBuilder` | Per-account `Dataset` creation |
| `AccountMapper` | `AutofillRepository` | React JSON → `AutofillAccount` parsing |
| `DomainMatcher` | `AutofillRepository` | Subdomain matching logic (`findMatchingAccounts`) |
| `FieldScoringRules` | `FieldScorer` | Scoring constants & helper functions |
| `BiometricAuthManager` | `KiyoBiometricActivity` | `BiometricManager` capability checks |

### Non-Extractions (Keep as-is)
| Item | Reason |
|------|--------|
| `ViewNodeUtils` | Core to autofill — split in Phase 5 after all tests pass |
| `LoginFormDetector` | Single function `hasLoginForm()` — keep in `FieldDetector` as private |
| `AutofillRepository` interface | Only one implementation — add when `FakeRepository` needed for tests |

### Actions
| Action | Details |
|--------|---------|
| Create `service/AuthRequestHandler.kt` | Extract token check + auth intent logic from `onFillRequest` |
| Create `response/DatasetFactory.kt` | Extract per-account dataset creation loop |
| Create `repository/AccountMapper.kt` | Move `parseReactAccount` + `extractDomain` |
| Create `repository/DomainMatcher.kt` | Move `findMatchingAccounts` subdomain traversal |
| Create `detection/FieldScoringRules.kt` | Extract scoring weights, keyword lists, helper methods |
| Create `biometric/BiometricAuthManager.kt` | Extract `BiometricManager` checks from Activity |
| Update `KiyoAutofillService` to use `AuthRequestHandler` | |
| Update `FillResponseBuilder` to use `DatasetFactory` | |
| Update `AutofillRepository` to use `AccountMapper` + `DomainMatcher` | |
| Update `FieldScorer` to use `FieldScoringRules` | |
| Update `KiyoBiometricActivity` to use `BiometricAuthManager` | |

### Verification
- Build passes
- Phase 0 checklist passes
- Each extracted class < 300 lines

---

## Phase 4: Coroutine & Async Structure (Medium Impact, Higher Risk)

**Goal**: Modernize async patterns. Actual behavior changes — test thoroughly.

### Actions
| Action | Details |
|--------|---------|
| Convert `AutofillRepository` to coroutines | Replace `ExecutorService` + `.get()` with `suspend` + `withContext(Dispatchers.IO)` |
| Make `DatabaseKeyManager.getKey()` suspend | Remove `runBlocking`; update callers in `AutofillDatabaseHelper` |
| Make `AutofillDatabaseHelper.getDatabase()` suspend | Or keep sync but call from coroutine context |
| Update `AutofillSessionStoreBridge` to call suspend functions | Keep blocking API for Java callers |
| Update `KiyoAutofillPlugin` Java calls | Use `runBlocking` at plugin boundary only |

### Verification
- Build passes
- Phase 0 checklist passes (critical — async changes can break timing)
- No ANR / UI thread blocking in logs

---

## Phase 5: ViewNodeUtils Split (Medium Impact, Medium Risk)

**Goal**: Split the 367-line god utility. **Only after Phase 0-4 all pass.**

### New Structure
```
viewnode/
  ├── ViewNodeTraversal.kt       # Core traverse/find functions
  ├── ViewNodeExtractor.kt       # Domain, package, title, appName extraction
  ├── HtmlAttributeExtractor.kt  # HTML attribute getters (type, autocomplete, name, id)
  └── ViewNodePredicate.kt       # isInputField, isContainer, isLeaf, isGoogleCandidate, etc.
```

### Actions
| Action | Details |
|--------|---------|
| Create `ViewNodeTraversal` | `traverse`, `findFocusedNode`, `dumpViewNodeTree` |
| Create `ViewNodeExtractor` | `extractDomainFromStructure`, `extractPackageNamesFromStructure`, `extractAppNameFromStructure`, `extractTitleFromStructure`, `hasPasswordFieldOnScreen`, `isKnownLoginDomain` |
| Create `HtmlAttributeExtractor` | `getHtmlInputType`, `getHtmlAutocomplete`, `getHtmlName`, `getHtmlId` |
| Create `ViewNodePredicate` | `isActualInputField`, `isContainerNode`, `isLeafNode`, `isGoogleAccountsDomain`, `isGoogleFieldCandidate` |
| Update all callers | `KiyoAutofillService`, `FieldDetector`, `FieldScorer`, `CredentialExtractor`, `FillResponseBuilder` |

### Verification
- Build passes
- Phase 0 checklist passes (critical — field detection must work identically)

---

## Phase 6: Capacitor Plugin Cleanup (Low Impact, Low Risk)

**Goal**: Remove dead code, simplify.

### Actions
| Action | Details |
|--------|---------|
| Remove `syncAccounts` method | Deprecated, keep only `syncAccountsFromReact` |
| Remove biometric `SharedPreferences` | `PREFS_NAME` / `KEY_BIOMETRIC_ENABLED` — verify unused on React side |
| Simplify `buildAutofillStatus` | Remove duplicate fields (`enabled`/`isEnabled`, `hasService`/`hasEnabledServices`) |
| Add null-safety annotations | `@Nullable` / `@NonNull` for Kotlin interop |

### Verification
- Build passes
- React side autofill settings still work

---

## Phase 7: Testing & Documentation (Ongoing)

### Actions
| Action | Details |
|--------|---------|
| Add unit tests for `FieldScoringRules` | Test scoring weights with various ViewNode configs |
| Add unit tests for `DomainMatcher` | Exact match, subdomain match, no match |
| Add unit tests for `AccountMapper` | React JSON parsing edge cases |
| Add unit tests for `AuthRequestHandler` | Token valid/expired/missing, encrypted/unencrypted |
| Add unit tests for `AutofillSessionStore` | Token expiry, encryption status |
| Document public APIs | KDoc for all public classes/functions |
| Update `.hermes.md` | Reflect final package structure |

---

## Implementation Order Summary

| Phase | Name | Priority | Risk | Depends On |
|-------|------|----------|------|------------|
| 0 | Baseline Freeze | **REQUIRED** | — | — |
| 1 | Eliminate Duplication | **HIGH** | Low | 0 |
| 2 | Package Reorganization | **HIGH** | Low | 1 |
| 3 | Responsibility Separation | **HIGH** | Medium | 2 |
| 4 | Coroutine & Async | **MEDIUM** | Higher | 3 |
| 5 | ViewNodeUtils Split | **MEDIUM** | Medium | 4 |
| 6 | Plugin Cleanup | **LOW** | Low | 2+ |
| 7 | Testing & Docs | **ONGOING** | Low | 3+ |

---

## Success Criteria

- [ ] Phase 0 checklist passes before AND after every phase
- [ ] No duplicate code (verified by `detekt` or manual inspection)
- [ ] Each file < 300 lines (except data classes)
- [ ] Clear package structure matching responsibilities
- [ ] Build passes (`./gradlew assembleDebug`)
- [ ] Autofill works on real device (Chrome + native apps)
- [ ] Unit tests cover scoring, domain matching, token logic, auth handling
- [ ] `.hermes.md` updated with final structure

---

## Notes

- **Do NOT modify React/TypeScript code** — this plan is Android native only
- **Run `npx cap sync android` after each phase** to sync web assets
- **Test on real device** — AutofillService behavior differs on emulator
- **Preserve SQLCipher encryption** — DatabaseKeyManager/Keystore logic must remain intact
- **Commit after each phase** — small, reviewable diffs