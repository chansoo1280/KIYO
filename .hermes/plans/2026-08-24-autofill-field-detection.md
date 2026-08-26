# Plan: Autofill Field Detection Improvements

**Date:** 2026-08-24  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도  
**Topic:** Field Detection Improvements

## Goal

Improve username/password field detection accuracy across common web sites and native apps.

## Changes

### 1. FieldScorer / FieldScoringRules Improvements

#### File: `android/app/src/main/java/com/kiyo/app/autofill/detection/FieldScoringRules.kt`

**Component:** `isValidInputField`  
**Change:** Fix WebView TODO: allow WebView internal nodes with proper autofillHints  
**Reason:** WebView in Samsung Internet, Chrome Custom Tabs not detected

**Component:** Constants  
**Change:** Tune scores: increase HTML autocomplete weight, decrease fallback  
**Reason:** Reduce false positives on non-login forms

#### File: `android/app/src/main/java/com/kiyo/app/autofill/detection/FieldScorer.kt`

**Component:** `calculateUsernameScore`  
**Change:** Add `htmlAutocomplete=one-time-code` as negative signal (OTP fields)  
**Reason:** OTP fields incorrectly matched as username

**Component:** `calculatePasswordScore`  
**Change:** Add `htmlAutocomplete=new-password` handling for registration forms  
**Reason:** Distinguish login vs registration

**Component:** Both  
**Change:** Log candidate details with structured format for debugging  
**Reason:** Easier log analysis for tuning

## Tests

### Unit Tests (JVM) - New Test File

**Test File:** `FieldScorerTest.kt` (NEW FILE)  
**Scenarios to Add:**
- `calculateUsernameScore` (autofillHints, HTML autocomplete/type, **OTP negative signal**)
- `calculatePasswordScore` (autofillHints, HTML autocomplete/type, **new-password handling**)

### Additions to Existing Test Files

**Test File:** `FieldScoringRulesTest`  
**Additions Only:**
- +3: WebView internal nodes with username/password autofillHints (replace TODO)
- +3: OTP `one-time-code` negative signal
- +3: `new-password` registration form signal

## Verification Criteria

- [ ] Unit tests pass for FieldScorer and FieldScoringRules
- [ ] Manual verification shows improved detection for:
  - WebView-based browsers (Samsung Internet, Chrome Custom Tabs)
  - OTP fields are not mistaken for username
  - Registration forms with new-password fields are handled appropriately
  - Reduced false positives on non-login forms

## Verification Structure (Test File by Test File)

| Test File | Type | Scenarios to Pass | Status |
|-----------|------|-------------------|--------|
| `FieldScorerTest` | JVM Unit | **NEW FILE** - `calculateUsernameScore` (autofillHints, HTML autocomplete/type, OTP negative signal), `calculatePasswordScore` (autofillHints, HTML autocomplete/type, new-password handling) | ⬜ Not Run |
| `FieldScoringRulesTest` | JVM Unit | **Existing 18 tests** + **3 new**: WebView internal nodes with username/password autofillHints, OTP `one-time-code` negative signal, `new-password` registration form signal | ⬜ Not Run |

**Pass Criteria:** All test files in this table must pass (green) for this plan to be complete.