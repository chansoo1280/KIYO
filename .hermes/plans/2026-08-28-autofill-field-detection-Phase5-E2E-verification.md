# Plan: Autofill Field Detection — Phase 5 Manual/E2E Verification

**Date:** 2026-08-28  
**Branch:** `feature/autofill-reliability`  
**Status:** Phases 1-4 implemented & merged. Phase 5 = manual verification only.  
**Related:** `.hermes/plans/2026-08-24-autofill-field-detection.md` (master plan)

---

## Goal

Verify the field detection improvements (Phases 1-4) work correctly on a real device/emulator with real web pages and apps.

---

## Prerequisites

- Emulator running (any AVD with API 26+)
- `adb devices` shows the device
- KIYO app installed (`npm run android:build` or `gradlew :app:installDebug`)
- At least 1 account registered in KIYO (e.g. username: `testuser`, password: `TestPass123!`, domain: `example.com`)

---

## Verification Scenarios

### Scenario 1: WebView internal node detection (Phase 3 #1-3)

**Purpose:** Confirm WebView internal nodes (Samsung Internet, Chrome Custom Tabs) are now recognized as valid input fields.

**Setup:**
1. Launch KIYO app → Settings → Sync Accounts → ensure 1+ accounts synced
2. Open **Samsung Internet** (or **Chrome**)

**Steps:**
1. Navigate to a login page (e.g. `https://github.com/login`)
2. Tap the username/email field
3. Observe autofill dropdown — should appear (previously it did not)
4. Select the KIYO account
5. Verify both username and password are filled

**Logcat verification:**
```bash
adb logcat -d -s FieldScorer:D FieldScoringRules:D | grep -E "FieldCandidate|WebView"
```
- Expect to see `className=...WebView...` entries with positive scores
- Field should be detected as valid (not rejected by `isValidInputField`)

**Pass criteria:**
- [ ] Autofill dropdown appears on WebView-based login page
- [ ] Fill succeeds (username + password populated)

---

### Scenario 2: OTP field NOT mistaken for username (Phase 2 OTP negative)

**Purpose:** Confirm `autocomplete=one-time-code` fields are excluded from username candidates.

**Setup:**
Find a page with a dedicated OTP/2FA input field with `autocomplete=one-time-code`. Options:
- `https://github.com/sessions/two-factor` (after logging in)
- Any bank login 2FA page
- Mock: create a local HTML file with `<input type="text" autocomplete="one-time-code">`

**Steps:**
1. Navigate to OTP entry page
2. Tap the OTP field
3. Observe autofill dropdown — should **NOT** appear (or if it appears, KIYO should not be selectable)
4. If a dropdown appears with KIYO account → **bug**

**Logcat verification:**
```bash
adb logcat -d -s FieldScorer:D | grep "one-time-code"
```
- Expect to see `htmlAutocomplete=one-time-code (OTP negative)` in reasons
- Score should be reduced by 100 (or return null if only signal)

**Pass criteria:**
- [ ] OTP field does not trigger autofill dropdown
- [ ] No username is filled into OTP field
- [ ] Logcat shows OTP negative signal applied

---

### Scenario 3: Registration form new-password handling (Phase 2 new-password bonus)

**Purpose:** Confirm `autocomplete=new-password` (without `current-password` on screen) gets registration bonus.

**Setup:**
Use a registration/signup page. Options:
- `https://github.com/signup`
- `https://www.reddit.com/register/`
- Any site with `<input type="password" autocomplete="new-password">` and no existing password field on screen

**Steps:**
1. Navigate to signup page
2. Fill username field manually OR trigger autofill
3. Tap the new-password field
4. Observe autofill dropdown — should appear
5. Select KIYO account
6. Verify password is filled in the new-password field

**Logcat verification:**
```bash
adb logcat -d -s FieldScorer:D | grep "new-password"
```
- Expect to see `htmlAutocomplete=new-password (registration form)` in reasons
- Score should include `SCORE_REGISTRATION_FORM` bonus (+50)

**Pass criteria:**
- [ ] Autofill dropdown appears on new-password field
- [ ] Password fills successfully
- [ ] Logcat shows registration bonus applied

---

### Scenario 4: Reduced false positives on non-login forms (Phase 1 #4-7)

**Purpose:** Confirm `SCORE_EDITTEXT_FALLBACK` reduction (10→5) and HTML autocomplete boost (150→180) reduces false positives.

**Setup:**
Test on non-login pages with EditText fields:
- Google search page (`https://google.com`) — search bar
- News site comment field
- Any form with plain EditText but no login semantics

**Steps:**
1. Navigate to non-login page (e.g. Google)
2. Tap a plain EditText field (search bar, comment box)
3. Observe autofill dropdown — should **NOT** appear (or appear less frequently)
4. If KIYO account is offered as autofill on a search bar → **false positive**

**Logcat verification:**
```bash
adb logcat -d -s FieldScorer:D | grep -E "EditText class fallback|htmlAutocomplete"
```
- Expect to see candidate scores around 5 (just EditText fallback) or 180 (if HTML autocomplete present)
- Search bar (no autofill hints) should score 5 → likely below threshold

**Pass criteria:**
- [ ] No autofill dropdown on plain search/comment fields
- [ ] Login fields still trigger dropdown (regression check)
- [ ] No regression on existing sites (verify a known working site still autofills)

---

## Regression Checks (must still pass)

These are existing behaviors that must NOT be broken:

- [ ] Native app autofill (e.g. KIYO test host) still works
- [ ] Existing username/password fields (with `autofillHints`) still autofill
- [ ] Google split-screen login (`accounts.google.com`) still works (special handling in FieldScorer)
- [ ] Existing unit tests still pass:
  ```bash
  cd android && ./gradlew :app:testDebugUnitTest
  ```

---

## Logcat Reference

Useful logcat filters:
```bash
# All field scoring decisions
adb logcat -s FieldScorer:D

# Field validation results
adb logcat -s FieldScoringRules:D

# Autofill service events
adb logcat -s AutofillService:D KiyoAutofillService:D

# Filter for structured candidate logs (single-line format)
adb logcat -s FieldScorer:D | grep "FieldCandidate"
```

Expected `FieldCandidate` log format:
```
FieldCandidate type=Username autofillId=... score=215 reasons=[autofillHints=username/email, inputType=TEXT_CLASS, EditText class fallback] className=... htmlAutocomplete=none htmlInputType=none
```

---

## Recording Results

For each scenario, record:
- ✅ Pass / ❌ Fail
- Screenshot if fail (for debugging)
- Relevant logcat snippet
- Any unexpected behavior

---

## When to Convert to Automated E2E

If scenarios 1-4 pass manually, consider automating via:
- `AutofillE2ETest` extension (add new `@Test` methods)
- `autofill-test-host` extension (add mock login/OTP/registration pages)
- PowerShell script similar to `run-autofill-e2e.ps1`

This is **out of scope for Phase 5** — track as separate plan if desired.

---

## Dependencies

- Phases 1-4 merged (✅ done)
- Emulator with API 26+
- KIYO app installed
- At least 1 test account synced

---

## Open Questions

| Question | Decision |
|----------|----------|
| Test on real device or emulator? | Emulator is sufficient (WebView behavior is identical) |
| Which specific sites to test? | Use the suggested ones (GitHub, Google, Reddit); record others tested |
| What if a scenario fails? | Capture logcat + screenshot, file as bug or revert if regression |
| Should this be automated? | Out of scope for now; manual verification sufficient for Phase 5 |
