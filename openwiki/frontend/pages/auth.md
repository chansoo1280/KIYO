---
type: page
title: Auth Page
description: PIN unlock and biometric unlock. Both paths converge on initializeStores + navigate(/accounts).
tags: [page, auth, pin, biometric, unlock, vault]
---
# Auth Page
Source File: /src/pages/Auth.tsx
Route: /auth
Responsibility
Two unlock paths:
- handleVerifyPin - PIN-based unlock.
- handleBiometricLogin - biometric (fingerprint/face) unlock.
Both paths converge on the same post-condition: sessionStore.setSession(...) + fileStorage.initializeStores() + navigate("/accounts").
Back-to-Home Flow
The page exposes a "back to Home" button that calls fileStorage.closeDataFile (which clears sessionStore including cryptoKey, and clears autofill sync state).
PIN Path
1. User enters PIN.
2. Validate length (>= 4) and confirmation match (for create).
3. Call fileStorage.unlockFile(fileName, pin) which uses fileTable.getActiveFileInfo + crypto.createCryptoKey(pin, salt) + crypto.decryptData(...).
4. On success, sessionStore.setSession({ fileName, cryptoKey, salt }) → initializeStores() (loads accounts/templates into stores) → navigate("/accounts").
Biometric Path
1. User taps biometric button.
2. Call KiyoSecureKey.unlockKeyWithBiometric({ vaultId: fileName }).
3. Native side: BiometricAuthHelper.authenticateWithPrompt → cipher.init(DECRY, masterKey, spec) → cipher.doFinal(encryptedKey) → returns base64 cryptoKey.
4. On success, sessionStore.setCryptoKeyFromBase64(keyBase64, salt) (which importKey + set) → initializeStores() → navigate("/accounts").
5. On BiometricKeyCorruptedException (GCM tag mismatch), the rejection carries data.keyCorrupted=true. Auth.tsx shows "biometric re-enrollment required" CTA.
Failures
- PIN_MISMATCH from fileStorage maps to "PIN 불일치" (PIN mismatch).
- Network / IO errors from KiyoSecureKey map via mapError utility.
Focused Tests
- src/pages/Auth.tsx has companion tests in the integration suite (fileStorage.lifecycle.integration.test.ts covers the underlying unlock flow; the component tests live in the e2e/ Playwright specs).
Source Anchors
- Page: /src/pages/Auth.tsx
- File storage: /src/database/fileStorage.ts (unlockFile, closeDataFile, initializeStores)
- Crypto: /src/crypto/encryption.ts (createCryptoKey, decryptData)
- SecureKey plugin: /src/plugins/kiyosecurekey.ts
- Error mapping: /src/utils/mapError.ts