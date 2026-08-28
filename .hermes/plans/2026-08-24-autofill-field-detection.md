# Plan: Autofill Field Detection Improvements

**Date:** 2026-08-24  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도  
**Topic:** Field Detection Improvements
**Phase Plans:** 
- Phase 1-2: Constants + Logic (`.hermes/plans/2026-08-24-autofill-field-detection-FieldScoringRules.md` — to be created)
- Phase 3: FieldScoringRulesTest (`.hermes/plans/2026-08-24-autofill-field-detection-FieldScoringRulesTest.md` — to be created)
- **Phase 4: FieldScorerTest (`.hermes/plans/2026-08-24-autofill-field-detection-FieldScorerTest.md`)**
- Phase 5: Manual/E2E Verification

---

## Goal

Improve username/password field detection accuracy across common web sites and native apps.

---

## Phase Overview (Execution Order: 1 → 2 → 3 → 4 → 5)

| Phase | Scope | Primary Files | Test Files |
|-------|-------|---------------|------------|
| **1** | Add constants to `FieldScoringRules.kt` | `FieldScoringRules.kt` | — |
| **2** | Implement scoring logic in `FieldScorer.kt` | `FieldScorer.kt` | — |
| **3** | Update `FieldScoringRulesTest.kt` | — | `FieldScoringRulesTest.kt` |
| **4** | Create `FieldScorerTest.kt` (NEW FILE) | — | `FieldScorerTest.kt` |
| **5** | Manual + E2E verification | Device/Emulator | — |

> Phase 4 plan: `.hermes/plans/2026-08-24-autofill-field-detection-FieldScorerTest.md`

---

## Changes

### 1. FieldScoringRules.kt (Phases 1 + 3)

#### Component: `isValidInputField` — WebView Internal Node Fixes

| # | Change | Reason | Verification (Phase 3 Test) |
|---|--------|--------|----------------------------|
| 1 | Fix WebView TODO: allow WebView internal nodes with proper autofillHints | WebView in Samsung Internet, Chrome Custom Tabs not detected | `isValidInputField returns true for WebView internal node with username hint` (replaces TODO) |
| 2 | Allow WebView internal nodes with HTML autocomplete attributes (username/password/email) | WebView nodes may have HTML autocomplete but not autofillHints | `isValidInputField returns true for WebView internal node with htmlAutocomplete=username` |
| 3 | Allow WebView internal nodes with HTML inputType attributes (email/password/text) | WebView nodes may have HTML inputType but not autofillHints | `isValidInputField returns true for WebView internal node with htmlInputType=email` |

#### Component: Constants — Score Tuning

| # | Change | Reason | Verification (Phase 3 Test) |
|---|--------|--------|----------------------------|
| 4 | Increase `SCORE_HTML_AUTOCOMPLETE_USERNAME` from 150 to 180 | HTML autocomplete is more reliable signal than class fallback | `calculateUsernameScore gives +180 for htmlAutocomplete=username` |
| 5 | Increase `SCORE_HTML_AUTOCOMPLETE_PASSWORD` from 150 to 180 | HTML autocomplete is more reliable signal than class fallback | `calculatePasswordScore gives +180 for htmlAutocomplete=current-password` |
| 6 | Decrease `SCORE_EDITTEXT_FALLBACK` from 10 to 5 | Reduce false positives on non-login forms | `calculateUsernameScore gives +5 for EditText fallback (no other signals)` |
| 7 | Decrease `SCORE_EDITTEXT_PASSWORD_FALLBACK` from 10 to 5 | Reduce false positives on non-login forms | `calculatePasswordScore gives +5 for EditText fallback with password variation` |
|| 8 | Add `SCORE_OTP_NEGATIVE = 100` | OTP negative signal magnitude | `calculateUsernameScore applies negative score for htmlAutocomplete=one-time-code` (Phase 4) |
|| 9 | Add `SCORE_REGISTRATION_FORM = 50` | new-password registration form bonus | `calculatePasswordScore applies registration bonus when new-password without current-password` (Phase 4) |

---

### 2. FieldScorer.kt (Phases 2 + 4)

| # | Component | Change | Reason | Verification |
|---|-----------|--------|--------|--------------|
| 1 | `calculateUsernameScore` | Add `htmlAutocomplete=one-time-code` as negative signal (OTP fields) | OTP fields incorrectly matched as username | Phase 4: `calculateUsernameScore applies negative score for htmlAutocomplete=one-time-code` (score reduced by **SCORE_OTP_NEGATIVE = 100**) |
| 2 | `calculateUsernameScore` | Add structured logging for candidate details | Easier log analysis for tuning | Phase 4: **ShadowLog capture** verifies format `FieldCandidate autofillId=<id> score=<score> reasons=[...] className=<class> htmlAutocomplete=<val>` |
| 3 | `calculatePasswordScore` | Add `htmlAutocomplete=new-password` registration form detection signal (simple score adjustment) | Distinguish login vs registration | Phase 4: `calculatePasswordScore applies registration bonus when new-password present without current-password` (bonus = **SCORE_REGISTRATION_FORM**) |
| 4 | `calculatePasswordScore` | Add structured logging for candidate details | Easier log analysis for tuning | Phase 4: **ShadowLog capture** verifies same structured format |

---

### 3. Future Enhancement: WebsitePreset Package Names (Out of Scope)

**Note:** To enable unified web + Android app autofill matching for popular sites, add `packageNames?: string[]` field to `WebsitePreset` model (`src/models/websitePreset.ts`) and populate for all 19 presets in `src/data/websitePresets.ts`. This is tracked separately and **not part of this plan's scope**.

---

## Tests — Phase-by-Phase Mapping

### Phase 3: FieldScoringRulesTest.kt Additions (to existing 18 tests)

| Test Method | Maps To Change | Type |
|-------------|----------------|------|
| `isValidInputField returns true for WebView internal node with username hint` | WebView Fix #1 | Replaces TODO |
| `isValidInputField returns true for WebView internal node with htmlAutocomplete=username` | WebView Fix #2 | New |
| `isValidInputField returns true for WebView internal node with htmlInputType=email` | WebView Fix #3 | New |
| `calculateUsernameScore gives +180 for htmlAutocomplete=username` | Constant #4 | New |
| `calculatePasswordScore gives +180 for htmlAutocomplete=current-password` | Constant #5 | New |
| `calculateUsernameScore gives +5 for EditText fallback (no other signals)` | Constant #6 | New |
| `calculatePasswordScore gives +5 for EditText fallback with password variation` | Constant #7 | New |
| `calculateUsernameScore applies negative score for htmlAutocomplete=one-time-code` | Constant #8 + FieldScorer #1 | New |
| `calculatePasswordScore applies registration bonus when new-password without current-password` | Constant #9 + FieldScorer #3 | New |

**Total Phase 3: 9 new tests** (18 existing + 9 = 27 tests)

---

### Phase 4: FieldScorerTest.kt (NEW FILE — 8 tests)

| Test Method | Maps To Change | Type |
|-------------|----------------|------|
| `calculateUsernameScore applies negative score for htmlAutocomplete=one-time-code` | FieldScorer #1 | Plan-specific |
| `calculateUsernameScore logs structured candidate details` | FieldScorer #2 | Plan-specific |
| `calculatePasswordScore applies registration bonus when new-password without current-password` | FieldScorer #3 | Plan-specific |
| `calculatePasswordScore logs structured candidate details` | FieldScorer #4 | Plan-specific |
| `calculateUsernameScore returns candidate for autofillHints=username` | Baseline coverage | Baseline |
| `calculateUsernameScore returns candidate for htmlAutocomplete=username` | Baseline coverage | Baseline |
| `calculatePasswordScore returns candidate for autofillHints=password` | Baseline coverage | Baseline |
| `calculatePasswordScore returns candidate for htmlInputType=password` | Baseline coverage | Baseline |

**Total Phase 4: 8 tests** (4 plan-specific + 4 baseline)

---

## Verification Criteria

### Unit Tests (Phases 3-4)

- [ ] **Phase 3**: `./gradlew test --tests "*FieldScoringRulesTest*"` — 27 tests pass (18 existing + 9 new)
- [ ] **Phase 4**: `./gradlew test --tests "*FieldScorerTest*"` — 8 tests pass (4 plan-specific + 4 baseline)
- [ ] **Combined**: `./gradlew test --tests "*FieldScorer*" --tests "*FieldScoringRules*"` — all pass

### Structured Logging (Phase 4 — Automated)

- [ ] Username log test captures via `ShadowLog`: `FieldCandidate autofillId=<id> score=<score> reasons=[...] className=<class> htmlAutocomplete=<val>`
- [ ] Password log test captures via `ShadowLog`: same format
- [ ] No manual logcat required for CI (manual as supplementary only)

### Manual/E2E Verification (Phase 5)

- [ ] WebView-based browsers (Samsung Internet, Chrome Custom Tabs) — field detection works
- [ ] OTP fields (`autocomplete=one-time-code`) — NOT mistaken for username
- [ ] Registration forms (`autocomplete=new-password` without `current-password`) — handled appropriately
- [ ] Reduced false positives on non-login forms

---

## Verification Structure (Test File by Test File)

| Test File | Type | Scenarios to Pass | Status |
|-----------|------|-------------------|--------|
| `FieldScorerTest` | JVM Unit | **NEW FILE** - 8 tests (4 plan-specific: OTP negative, logging×2, new-password; 4 baseline) | ⬜ Not Run |
| `FieldScoringRulesTest` | JVM Unit | **Existing 18 tests** + **9 new**: WebView internal nodes (3), score constants (4), OTP negative (1), new-password bonus (1) | ⬜ Not Run |

**Pass Criteria:** All test files in this table must pass (green) for this plan to be complete.

---

## Dependencies (Strict Order)

1. **Phase 1**: `FieldScoringRules.kt` — Add constants: `SCORE_OTP_NEGATIVE = 100`, `SCORE_REGISTRATION_FORM` (value TBD), tuned constants (HTML autocomplete 150→180, fallback 10→5)
2. **Phase 2**: `FieldScorer.kt` — Implement OTP negative, new-password bonus, structured logging (single-line format for ShadowLog capture)
3. **Phase 3**: `FieldScoringRulesTest.kt` — WebView TODO replacements + constant tests + OTP/new-password tests
4. **Phase 4**: `FieldScorerTest.kt` — New file, compiles only after Phase 1-2 (see Phase 4 plan)
5. **Phase 5**: Manual/E2E verification on device/emulator

---

## Open Questions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| OTP signal strength | **-100** (`SCORE_OTP_NEGATIVE = 100`) | Same magnitude as positive autofillHints bonus; strong enough to push OTP below valid username |
| new-password handling | **Simple score adjustment** (bonus) | No SaveInfo trigger; registration form detection via score only; UX handled at fill-response layer |
| Structured logging verification | **ShadowLog capture** in unit tests | Automatable, CI-friendly; manual logcat as supplementary only |
| WebView class name variations | Deferred to Phase 1 implementation | Need device testing/log analysis; will expand allowlist in `isValidInputField` |
| Score tuning validation | Manual test matrix in Phase 5 | Verify no regression on existing sites; iterate if needed |