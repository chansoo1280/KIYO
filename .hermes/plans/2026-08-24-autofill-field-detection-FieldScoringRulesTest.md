# Plan: Autofill Field Detection — FieldScoringRulesTest.kt

**Date:** 2026-08-24  
**Branch:** `feature/autofill-reliability`  
**Target Test File:** `android/app/src/test/java/com/kiyo/app/autofill/detection/FieldScoringRulesTest.kt`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도

---

## Goal

Add unit tests to `FieldScoringRulesTest.kt` covering all `FieldScoringRules.kt` changes.

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

---

## Test Implementation Notes

- All tests use existing mockk + Robolectric setup (see `@Before` setup)
- Tests 1-3 replace the 3 skipped TODO tests at lines 55-62
- Tests 4-7 are new tests verifying score constant values
- Helper: use `HtmlAttributeExtractor` mocking for HTML attribute tests (2, 3)

---

## Verification Criteria

- [ ] All 7 new/modified tests in `FieldScoringRulesTest.kt` pass
- [ ] Existing 18 tests still pass (no regression)
- [ ] Run: `./gradlew test --tests "*FieldScoringRulesTest*"`

---

## Dependencies

- Requires `FieldScoringRules.kt` changes to be implemented first
- No dependency on `FieldScorer.kt` changes