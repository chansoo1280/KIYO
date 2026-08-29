# Plan: Autofill Authentication UX Improvements

**Date:** 2026-08-24  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도  
**Topic:** Authentication UX Improvements

## Goal

Ensure biometric prompt → PIN/pattern fallback flow works smoothly with no stale auth state.

## Changes

This section focuses on verifying and potentially improving the authentication UX flow. Most of the logic is already in place in `AuthRequestHandler.kt` and related components. We will:

1. Verify existing implementation handles the flow correctly
2. Add tests for edge cases
3. Ensure no stale auth state remains after failed/cancelled auth attempts

### Key Components to Verify

**File:** `android/app/src/main/java/com/kiyo/app/autofill/service/AuthRequestHandler.kt`
- Handles DB_KEY access via `DatabaseKeyManager.getKey()`
- Catches `UserNotAuthenticatedException` and returns auth response via `FillResponseBuilder.createAuthResponse()`
- On successful biometric/PIN auth, re-triggers fill request

**File:** `android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt`
- Delegates to `AuthRequestHandler`
- Handles the callback from fill request

**File:** `android/app/src/main/java/com/kiyo/app/autofill/response/FillResponseBuilder.kt`
- Creates auth datasets that trigger biometric prompt
- Creates fill datasets with account data

## Tests

### Unit Tests (JVM) - Additions to Existing Test File

**Test File:** `AuthRequestHandlerTest` (already exists with 6 tests)
**Additions:**
- Test that cancelled biometric prompt does not leave stale auth state
- Test that failed PIN attempt does not leave stale auth state
- Test that successful auth followed by immediate re-request works without промпт (when cache valid)
- Test edge case: auth required during sync from React

### Android Instrumentation Tests

**File:** `android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt`
We'll rely on the existing `resyncAfterDeviceCredentialAdded_authRequired` test which already covers:
- PIN setup → resync (triggers auth-required) → 35s Keystore cache expiry wait → testHost entry → auth dataset tap → BiometricPrompt PIN entry → actual account fill verification

This test already validates the biometric → PIN fallback flow works.

## Manual Verification Scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| Biometric → PIN fallback | Register biometric → auth prompt → cancel → PIN entry | Fallback works smoothly, no stale state |
| Biometric success | Register biometric → auth prompt → biometric success | Immediate fill without 재프롬프트 |
| Multiple rapid auth requests | Trigger multiple fill requests while auth prompt is showing | Only one auth prompt shown, requests queued properly |
| Auth during sync | Set PIN → modify account in React → sync triggers auth required | Proper auth flow initiated |
| Cache expiration | Successful auth → wait 35s (debug) / 30min (release) → new fill request | Auth prompt shown again |

## Verification Criteria

- [ ] AuthRequestHandler unit tests pass (including new additions)
- [ ] Existing E2E test `resyncAfterDeviceCredentialAdded_authRequired` passes
- [ ] Manual verification shows:
  - Biometric prompt appears when auth required
  - Cancelling biometric prompt shows PIN/pattern fallback
  - Successful biometric auth leads to immediate fill on re-request
  - No stale auth state after failed/cancelled attempts
  - Auth cache properly expires and requires re-auth

## Verification Structure (Test File by Test File)

| Test File | Type | Scenarios to Pass | Status |
|-----------|------|-------------------|--------|
| `AuthRequestHandlerTest` | JVM Unit | **Existing 6 tests** + **4 new**: cancelled prompt no stale state, failed PIN no stale state, successful auth + immediate re-request, auth required during sync | ⬜ Not Run |
| `AutofillE2ETest` | Android Instrumentation | **Existing 2 tests** (includes `resyncAfterDeviceCredentialAdded_authRequired` which validates biometric→PIN fallback) | ⬜ Not Run |

**Pass Criteria:** All test files in this table must pass (green) for this plan to be complete.