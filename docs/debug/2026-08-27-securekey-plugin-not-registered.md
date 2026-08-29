# Debug Report: SecureKey Plugin Not Registered + BiometricAuthHelper cipher.init Throws Without Prompting

## Issue (Two bugs)

### Bug 1: SecureKeyPlugin not registered in MainActivity.java
- **Command that fails**: `powershell -File run-biometric-e2e.ps1 -SkipBuild -SkipSetup -TestMethod storeKey_enrollsBiometricProtection`
- **Error message**: `"SecureKey" plugin is not implemented on android` (Capacitor/Console)
- **Root cause**: `MainActivity.java` registers `KiyoAutofillPlugin` and `KiyoFilePlugin` but never registers `SecureKeyPlugin`. The plugin was added in commit `cff04bb3` ("feat: add biometric login with Android Keystore CryptoObject pattern") but the registration was omitted.
- **Evidence (logcat)**:
  ```
  W Capacitor/Console: "SecureKey" plugin is not implemented on android
  ```
- **Fix**: Add `import com.kiyo.app.securekey.SecureKeyPlugin` + `registerPlugin(SecureKeyPlugin.class)` in MainActivity constructor.

### Bug 2: BiometricAuthHelper.storeKey/unlockKeyWithBiometric never show BiometricPrompt
- **Error (after Bug 1 fix)**: `java.lang.AssertionError: Biometric enable should succeed` at `BiometricUnlockE2ETest.kt:272`
- **Root cause**: `cipher.init(Cipher.ENCRYPT_MODE, masterKey)` at `BiometricAuthHelper.kt:51` throws `UserNotAuthenticatedException` before `BiometricPrompt.authenticate()` is ever called. The exception is caught by the outer `catch (e: Exception)` block (line 105), which returns `Result.failure(e)`. The `BiometricPrompt` code (lines 53-101) is **dead code** — it can never execute.
- **Same pattern in `unlockKeyWithBiometric`**: `cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)` at line 127 has the same issue.
- **Evidence (logcat)**:
  ```
  E BiometricAuthHelper: storeKey failed
  E BiometricAuthHelper: android.security.keystore.UserNotAuthenticatedException: User not authenticated
  ```

## Investigation

### Tight feedback loop
- Re-enroll fingerprint → clear logcat → run test → check logcat → check UI hierarchy dumps
- Fail rate: 100% (consistent, not flaky)

### Timeline of errors
1. **Initial**: "Biometric setup dialog did not appear" (SettingsSection `isBiometryAvailable()` returns `available: false` because plugin not registered)
2. **After Bug 1 fix**: "Biometric enable should succeed" (dialog appears, `등록하기` clicked, `AWAIT_FINGER` marker emitted, but `storeKey` fails with `UserNotAuthenticatedException` instead of showing BiometricPrompt)

### Data flow trace (after Bug 1 fix)
1. `SettingsPage.enableBiometric()` clicks "사용 안 함" → "생체인증 등록" dialog → "등록하기"
2. `handleBiometricSetupConfirm` in React → `SecureKey.storeKey({vaultId, key})`
3. `SecureKeyPlugin.storeKey` → `BiometricAuthHelper.storeKey(vaultId, key)`
4. `getOrCreateMasterKey()` — creates `kiyo_secure_master_key` with `setUserAuthenticationRequired(true)` (first call succeeds)
5. `cipher.init(Cipher.ENCRYPT_MODE, masterKey)` — **throws `UserNotAuthenticatedException`** (key requires biometric auth, user hasn't authenticated yet)
6. Exception caught by outer `catch (e: Exception)` → `Result.failure(e)` → React gets error → no success message rendered

### Root cause of Bug 2
The standard Android biometric crypto pattern requires:
```kotlin
try {
    cipher.init(Cipher.ENCRYPT_MODE, key)  // may throw UserNotAuthenticatedException
} catch (e: UserNotAuthenticatedException) {
    // This is expected — show BiometricPrompt to authenticate
    biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
}
```

The current code doesn't catch `UserNotAuthenticatedException` — it lets it propagate to the generic `catch (e: Exception)` at line 105, which means `BiometricPrompt.authenticate()` is never called.

## Hypotheses (Ranked)

### H1 (CONFIRMED — Primary Root Cause: Bug 2)
- **Theory**: `cipher.init(ENCRYPT_MODE, masterKey)` throws `UserNotAuthenticatedException` which is caught by the generic Exception handler, preventing `BiometricPrompt` from being shown.
- **Prediction**: After catching `UserNotAuthenticatedException` specifically and proceeding to `BiometricPrompt.authenticate(promptInfo, CryptoObject(cipher))`, the biometric prompt will appear, the host watcher will inject `finger touch`, and `storeKey` will succeed.
- **Test**: Modify `BiometricAuthHelper.kt` to catch `UserNotAuthenticatedException` from `cipher.init` and proceed to show `BiometricPrompt`.
- **Security impact**: LOW — implements the standard Android biometric crypto pattern as documented in Android's official BiometricPrompt guide. No security properties change.

### H2 (Ruled out — Already fixed)
- **Theory**: `SecureKeyPlugin` not registered in `MainActivity.java`.
- **Test result**: After adding `registerPlugin(SecureKeyPlugin.class)`, logcat confirms `"SecureKey plugin loaded"` and `isBiometryAvailable()` returns `{"available":true,"type":"fingerprint"}`.
- **Status**: FIXED and verified.

## Recommended Fix

**File**: `android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelper.kt`

Two changes needed:

1. **`storeKey` (line 51)**: Wrap `cipher.init(Cipher.ENCRYPT_MODE, masterKey)` in try-catch for `UserNotAuthenticatedException`. On catch, proceed to `BiometricPrompt.authenticate()` (which is the intended flow).

2. **`unlockKeyWithBiometric` (line 127)**: Same pattern — wrap `cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)` in try-catch for `UserNotAuthenticatedException`, then proceed to `BiometricPrompt.authenticate()`.

**Alternative (simpler)**: Change `cipher.init(ENCRYPT_MODE, key)` → `cipher.init(ENCRYPT_MODE, key, KeyGenParameterSpec.setUserAuthenticationRequired(false))` to avoid the exception, but this weakens security. **Not recommended.**

**Security impact**: LOW — implementing the standard documented pattern. No key material change, no auth bypass.

## Debug Artifacts
- Failure UI hierarchy: `kiyo_test_uiautomator_FAILURE_storeKey_enrollsBiometricProtection_*.xml` (in emulator /sdcard/Download/)
- Failure screenshot: `kiyo_test_screen_FAILURE_storeKey_enrollsBiometricProtection_*.png` (in emulator /sdcard/Download/)
- logcat evidence: Capacitor/Console warnings about "SecureKey" plugin not implemented; `UserNotAuthenticatedException` stack trace

## Pre-applied non-production changes
- `BiometricUnlockE2ETest.kt`: Fixed `settingsPage` not initialized in scenario 1 (using `ensureEncryptedVault()` instead of `settingsPage.ensureEncryptedVault(...)`)
- `BiometricUnlockE2ETest.kt`: Fixed scenario 3 to emit `CANCEL_FINGER` marker instead of `AWAIT_FINGER`
- `BiometricAuthHelper.kt`: Temporary debug `Log.d` added then **REVERTED**
