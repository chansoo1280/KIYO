---
type: capacitor-plugin
title: KiyoSecureKey Web Contract
description: Web-side TypeScript contract for biometric vault unlock plugin (storeKey, unlockKeyWithBiometric, hasKey, deleteKey, isBiometryAvailable).
tags: [capacitor, plugin, biometric, securekey, web]
---
# KiyoSecureKey (Web)
Source Files: /src/plugins/kiyosecurekey.ts (real/native) and /src/plugins/kiyosecurekey.web.ts (web fallback).
Bridge Path
- Native impl: /android/app/src/main/java/com/kiyo/app/securekey/SecureKeyPlugin.kt
- Helper: BiometricAuthHelperFactory creates BiometricAuthHelper bound to the host FragmentActivity.
API Surface
```typescript
export interface KiyoSecureKeyPlugin {
  storeKey(options: { vaultId: string; cryptoKeyBase64: string }): Promise<void>
  unlockKeyWithBiometric(options: { vaultId: string }): Promise<{ key: string /* base64 */ }>
  hasKey(options: { vaultId: string }): Promise<{ exists: boolean }>
  deleteKey(options: { vaultId: string }): Promise<void>
  isBiometryAvailable(): Promise<{ available: boolean; hasFingerprint: boolean; hasFace: boolean }>
}
```
Web Fallback (kiyosecurekey.web.ts)
On web builds, all methods reject with no-op errors (or return safe defaults):
- storeKey / unlockKeyWithBiometric / deleteKey → reject("SecureKey is only available on Android")
- hasKey → { exists: false }
- isBiometryAvailable → { available: false, hasFingerprint: false, hasFace: false }
Rejection Payload
The native plugin rejects with `{ data: { keyCorrupted?: boolean } }` when the GCM tag check fails inside BiometricAuthHelper (BiometricKeyCorruptedException). Auth.tsx reads this and shows a "re-enroll biometric" CTA.
Consumers
- pages/Auth.tsx - unlockKeyWithBiometric.
- pages/Settings/components/SecuritySection.tsx - hasKey / storeKey / deleteKey / isBiometryAvailable.
Source Anchors
- Web: /src/plugins/kiyosecurekey.ts, /src/plugins/kiyosecurekey.web.ts
- Native: /android/app/src/main/java/com/kiyo/app/securekey/SecureKeyPlugin.kt
- BiometricAuthHelper: /android/app/src/main/java/com/kiyo/app/securekey/BiometricAuthHelper.kt