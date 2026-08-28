# Plan: Autofill Field Detection — FieldScoringRulesTest.kt

**Date:** 2026-08-24  
**Branch:** `feature/autofill-reliability`  
**Target Test File:** `android/app/src/test/java/com/kiyo/app/autofill/detection/FieldScoringRulesTest.kt`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도

---

## Goal

Add unit tests to `FieldScoringRulesTest.kt` covering all `FieldScoringRules.kt` changes (Phases 1+3).

---

## Changes to Test (from FieldScoringRules.kt)

| # | Component | Change | Verification (Test Method) |
|---|-----------|--------|---------------------------|
| 1 | `isValidInputField` | Fix WebView TODO: allow WebView internal nodes with username/password autofillHints | `isValidInputField returns true for WebView internal node with username hint` (replaces TODO @ line 55) |
| 2 | `isValidInputField` | Allow WebView internal nodes with HTML autocomplete (username/password/email) | `isValidInputField returns true for WebView internal node with htmlAutocomplete=username` |
| 3 | `isValidInputField` | Allow WebView internal nodes with HTML inputType (email/password/text) | `isValidInputField returns true for WebView internal node with htmlInputType=email` |
| 4 | Constants | `SCORE_HTML_AUTOCOMPLETE_USERNAME`: 150 → 180 | `calculateUsernameScore gives +180 for htmlAutocomplete=username` |
| 5 | Constants | `SCORE_HTML_AUTOCOMPLETE_PASSWORD`: 150 → 180 | `calculatePasswordScore gives +180 for htmlAutocomplete=current-password` |
| 6 | Constants | `SCORE_EDITTEXT_FALLBACK`: 10 → 5 | `calculateUsernameScore gives +5 for EditText fallback (no other signals)` |
| 7 | Constants | `SCORE_EDITTEXT_PASSWORD_FALLBACK`: 10 → 5 | `calculatePasswordScore gives +5 for EditText fallback with password variation` |
| 8 | Constants | Add `SCORE_OTP_NEGATIVE = 100` | `calculateUsernameScore applies negative score for htmlAutocomplete=one-time-code` |
| 9 | Constants | Add `SCORE_REGISTRATION_FORM = 50` | `calculatePasswordScore applies registration bonus when new-password without current-password` |

---

## Test Implementation Notes

- All tests use existing mockk + Robolectric setup (see `@Before` setup)
- Tests 1-3 replace the 3 skipped TODO tests at lines 55-62
- Tests 4-7 are new tests verifying score constant values
- Tests 8-9 verify OTP negative signal and new-password registration bonus (require Phase 1 constants)
- **Helper for WebView HTML tests (2, 3)**: Mock `AssistStructure.HtmlInfo` with `attributes` containing `autocomplete` / `type` pairs (not `HtmlAttributeExtractor` — that's used in `FieldScorer`, not `FieldScoringRules`)

---

## Verification Criteria

- [ ] All 9 new/modified tests in `FieldScoringRulesTest.kt` pass
- [ ] Existing 18 tests still pass (no regression)
- [ ] Run: `./gradlew test --tests "*FieldScoringRulesTest*"`

---

## Dependencies

- Requires `FieldScoringRules.kt` changes to be implemented first
- No dependency on `FieldScorer.kt` changes