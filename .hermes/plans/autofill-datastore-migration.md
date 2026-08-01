# KIYO Autofill DataStore Migration Plan

## Overview
Replace `SecuritySession` (in-memory) with `androidx.datastore:datastore-preferences` for persistent autofill token storage across process restarts.

## DataStore Schema (`autofill_prefs`)

| Key | Type | Description |
|-----|------|-------------|
| `autofill_token` | String | Auth token issued on PIN/biometric unlock |
| `token_expire_at` | Long | Token expiry timestamp (epoch ms), default 30 min |
| `is_encrypted` | Boolean | Whether current vault is encrypted |

## Implementation Tasks

### 1. Create `AutofillDataStore.kt` (New)
- Location: `android/app/src/main/java/com/kiyo/app/autofill/AutofillDataStore.kt`
- Wrapper around `Preferences DataStore`
- Methods:
  - `saveAutofillToken(token: String, expireAt: Long, isEncrypted: Boolean)`
  - `getAutofillToken(): String?`
  - `getTokenExpireAt(): Long?`
  - `isEncrypted(): Boolean`
  - `clear()` - on logout/vault switch

### 2. Refactor `KiyoAutofillService.kt`
- Replace `SecuritySession.get()` / `isEncrypted()` calls with `AutofillDataStore`
- New fill request logic:
  1. Check `isEncrypted` → if false, return fill response directly
  2. If encrypted, check token validity (`token != null && now < expireAt`)
  3. If no valid token → return `FillResponseBuilder.createAuthResponse()`
  4. If valid token → return fill response

### 3. Add Capacitor Plugin Method (`KiyoAutofillPlugin.java`)
- `setAutofillToken(token, expireAt, isEncrypted)` - called from React on auth success
- `clearAutofillToken()` - called on logout/vault switch

### 4. Remove `SecuritySession.kt` + Update React
- Delete `android/app/src/main/java/com/kiyo/app/security/SecuritySession.kt`
- Update `src/store/sessionStore.ts` - remove SecuritySession bridge calls
- Update `src/hooks/useKiyoAutofill.ts` / `src/plugins/kiyautofill.ts` - call new plugin method

### 5. Set `isEncrypted=false` on Unencrypted Vault Open/Create
- In `DatabaseKeyManager.getKey()` or file open flow
- When vault has no encryption → save `isEncrypted=false` to DataStore

## Token Expiry
- Fixed 30 minutes (1800000 ms) from issuance
- Configurable later if needed

## Testing
- Unit tests for `AutofillDataStore`
- Integration test: fill request with/without valid token
- Verify process restart persistence