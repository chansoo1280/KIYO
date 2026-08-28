# Brainstorm: Autofill Field Detection Improvements

**Date:** 2026-08-28  
**Related Plan:** `.hermes/plans/2026-08-24-autofill-field-detection.md`  
**Branch:** `feature/autofill-reliability`  
**Track:** STRATEGY.md Track 1 — 자동완성 신뢰도

---

## Problem

The current field detection (FieldScorer + FieldScoringRules) has known gaps:
1. **WebView internal nodes** — Samsung Internet, Chrome Custom Tabs not detected due to a TODO in `isValidInputField` and skipped tests
2. **OTP fields mistaken for username** — `autocomplete=one-time-code` fields receive positive username score
3. **Registration vs login confusion** — `autocomplete=new-password` fields need distinct handling
4. **Score tuning needed** — HTML autocomplete signals underweighted vs fallback signals

---

## Goal

Improve username/password field detection accuracy across:
- WebView-based browsers (Samsung Internet, Chrome Custom Tabs)
- OTP fields (not matched as username)
- Registration forms (new-password handling)
- Reduce false positives on non-login forms

---

## Context

### Existing Architecture

**File: `FieldScoringRules.kt`**
- `isValidInputField()` — validates nodes; has WebView TODO (lines 83-92)
- Scoring constants (lines 37-57)
- Helper functions: `isEditTextClass`, `isPasswordVariation`, `isVisiblePasswordVariation`, `isEmailVariation`, `isTextClass`

**File: `FieldScorer.kt`**
- `calculateUsernameScore()` — 9 scoring rules (autofillHints, HTML autocomplete/type, inputType, name/id, hint/resourceId, Google special, EditText fallback)
- `calculatePasswordScore()` — 8 scoring rules
- Both use `HtmlAttributeExtractor` for HTML attributes

**File: `FieldDetector.kt`**
- Post-order traversal to find best candidate
- Tie-breaker: prefer leaf nodes

**File: `HtmlAttributeExtractor.kt`**
- Pure extraction: `getHtmlInputType`, `getHtmlAutocomplete`, `getHtmlName`, `getHtmlId`

### Current Test State

**`FieldScoringRulesTest.kt`** — 18 tests, 3 TODOs skipped (WebView internal nodes)
**`FieldScorerTest.kt`** — Does not exist (planned as NEW FILE)

### Previous Knowledge (from related plans)

- `2026-08-24-autofill-reliability.md` — Master plan covering all Track 1 work
- `2026-08-24-autofill-keystore-auth.md` — Keystore auth cache testing (passed E2E)
- `2026-08-24-autofill-auth-ux.md` — Biometric→PIN fallback UX
- `2026-08-24-autofill-domain-matching.md` — Domain matching (26/26 tests passing)

---

## Constraints

### Security Constraints
- **No weakening of detection logic** that could cause wrong field filling
- Field detection runs in AutofillService (separate process) — must be deterministic
- False positives = credential leakage risk

### Lifecycle Constraints
- AutofillService runs in separate process from MainActivity
- Field detection runs fresh per `onFillRequest` — no cached state
- Must handle ViewNode tree traversal efficiently

### Platform Constraints
- Android API 26+ (AutofillService minimum)
- WebView internal nodes have different class names (WebView, Chromium variants)
- HTML attributes from `AssistStructure.ViewNode.htmlInfo` — may be null

### Testing Constraints
- JVM unit tests (Robolectric + mockk) — no real AndroidKeyStore provider
- E2E tests require emulator — `npm run test:e2e:android`
- Manual verification on real sites needed for WebView detection

### Backward Compatibility
- Existing scoring must not regress on known working sites
- Score changes should be incremental with logging for analysis

---

## Options

### Option A: Minimal Targeted Fixes (Recommended)

**Scope:** Only address the 4 specific issues in the plan

| Change | File | Risk |
|--------|------|------|
| Fix WebView internal node validation | `FieldScoringRules.kt:83-92` | Low — expands allowlist |
| Add OTP negative signal (`one-time-code`) | `FieldScorer.kt:calculateUsernameScore` | Low — subtracts score |
| Add `new-password` handling for registration | `FieldScorer.kt:calculatePasswordScore` | Low — distinguishes form type |
| Tune scores (increase HTML autocomplete, decrease fallback) | `FieldScoringRules.kt` constants | Medium — affects all sites |
| Add structured logging | `FieldScorer.kt` both methods | Low — debug only |

**Advantages:**
- Low risk, surgical changes
- Directly addresses documented issues
- Existing tests mostly unaffected
- Easy to verify with manual testing

**Disadvantages:**
- Score tuning may need iteration
- WebView detection depends on OEM implementations

---

### Option B: Comprehensive Re-scoring with ML-style Weights

**Scope:** Redesign scoring with configurable weights, per-site profiles

**Advantages:**
- More flexible for future sites
- Could learn from user feedback

**Disadvantages:**
- Over-engineering for current need
- Adds complexity (config, persistence)
- Harder to test deterministically
- STRATEGY.md: "자동완성 품질 저하는 허용하되 핵심 보안은 절대 타협 안 함" — but also "단순함" 선호

---

### Option C: Heuristic Expansion (More Rules)

**Scope:** Add more keyword lists, domain-specific rules, form structure analysis

**Advantages:**
- Could catch more edge cases

**Disadvantages:**
- Maintenance burden
- Rule explosion
- Harder to reason about interactions

---

## Recommended Direction

**Option A (Minimal Targeted Fixes)** with these specific implementation details:

### 1. Fix WebView Internal Node Validation
```kotlin
// FieldScoringRules.kt:isValidInputField() lines 83-92
// Current TODO allows WebView nodes with username/password/email autofillHints
// Expand to also check HTML autocomplete attributes for WebView nodes
```

### 2. OTP Negative Signal
```kotlin
// FieldScorer.kt:calculateUsernameScore()
// After HTML autocomplete check (line 71-79), add:
val htmlAutocomplete = HtmlAttributeExtractor.getHtmlAutocomplete(node)
if (htmlAutocomplete != null && htmlAutocomplete.contains("one-time-code")) {
    score -= FieldScoringRules.SCORE_OTP_NEGATIVE  // new constant: 100
    reasons.add("htmlAutocomplete=one-time-code (OTP negative)")
}
```

### 3. New-Password Handling for Registration
```kotlin
// FieldScorer.kt:calculatePasswordScore()
// Current line 210-211 already includes new-password in positive check
// Add: if new-password detected WITHOUT current-password on same screen → registration form signal
// Could add a small bonus or separate registration form detection
```

### 4. Score Tuning
```kotlin
// FieldScoringRules.kt constants:
// Increase: SCORE_HTML_AUTOCOMPLETE_USERNAME 150→180, SCORE_HTML_AUTOCOMPLETE_PASSWORD 150→180
// Decrease: SCORE_EDITTEXT_FALLBACK 10→5, SCORE_EDITTEXT_PASSWORD_FALLBACK 10→5
// Rationale: HTML autocomplete is more reliable signal than class fallback
```

### 5. New Test File: FieldScorerTest.kt
Create comprehensive unit tests covering:
- Username: autofillHints, HTML autocomplete/type, **OTP negative signal**
- Password: autofillHints, HTML autocomplete/type, **new-password handling**

### 6. FieldScoringRulesTest.kt Additions
- WebView internal nodes with username/password autofillHints (replace 3 TODOs)
- OTP `one-time-code` negative signal
- `new-password` registration form signal

---

## Open Questions

1. **WebView class name variations** — What exact class names do Samsung Internet / Chrome Custom Tabs use for internal nodes? Need device testing or log analysis.

2. **OTP signal strength** — Is -100 enough to push OTP fields below valid username fields? Or should it be -200 (same as positive autofillHints)?

3. **Registration vs login distinction** — Should `new-password` trigger a different fill response (SaveInfo for new credentials) or just score adjustment?

4. **Score tuning validation** — How to verify score changes don't regress on existing sites? Need manual test matrix.

5. **HTML attribute availability** — Are `htmlAutocomplete` and `htmlInputType` reliably populated for WebView internal nodes? Current code assumes they might be.

---

## Brainstorm Conclusion

| Item | Decision |
|------|----------|
| **Problem understood** | Yes — 4 specific detection gaps documented |
| **Recommended direction** | Option A: Minimal targeted fixes with surgical changes |
| **Important unknowns** | WebView class names, OTP signal strength, registration form UX |
| **Plan can be created** | Yes — existing plan `.hermes/plans/2026-08-24-autofill-field-detection.md` is complete and implementation-ready |

---

## Next Steps

1. **Create `FieldScorerTest.kt`** — New test file with OTP and new-password scenarios
2. **Update `FieldScoringRulesTest.kt`** — Replace 3 TODOs + add 2 new test cases
3. **Implement WebView fix** — Expand `isValidInputField` for WebView internal nodes
4. **Add OTP negative signal** — In `calculateUsernameScore`
5. **Add new-password handling** — In `calculatePasswordScore`
6. **Tune score constants** — Increase HTML autocomplete, decrease fallback
7. **Add structured logging** — For debugging candidate scores
8. **Run unit tests** — `./gradlew test --tests "*FieldScorer*" --tests "*FieldScoringRules*"`
9. **Manual verification** — Samsung Internet, Chrome Custom Tabs, OTP forms, registration forms
10. **E2E validation** — `npm run test:e2e:android` (if detection changes affect fill)