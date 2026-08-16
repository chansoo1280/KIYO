# 생체인증 로그인 구현 계획 (수정본 v2)

## 개요
앱 모듈 내장 `SecureKey` 플러그인으로 생체인증 기반 크립토키 저장/복원 기능 추가

---

## 플러그인 구조

```
android/app/src/main/java/com/kiyo/app/securekey/
├── SecureKeyPlugin.kt          # Capacitor 플러그인 진입점
├── SecureKeyManager.kt         # Keystore 래핑/언래핑 로직
└── BiometricAuthHelper.kt      # 생체인증 프롬프트 헬퍼 (Android BiometricPrompt 직접 사용)
```

---

## 플러그인 API (TypeScript: `src/plugins/kiyosecurekey.ts`)

| 메서드 | 설명 |
|--------|------|
| `storeKey(options: { vaultId: string; key: string }): Promise<void>` | cryptoKey(base64)를 Keystore로 암호화해 DataStore 저장 (생체인증 프롬프트 포함) |
| `unlockKeyWithBiometric(options: { vaultId: string }): Promise<{ key: string }>` | 생체인증 후 복호화된 cryptoKey 반환 |
| `deleteKey(options: { vaultId: string }): Promise<void>` | 저장된 키 삭제 |
| `hasKey(options: { vaultId: string }): Promise<{ exists: boolean }>` | 키 존재 여부 확인 |
| `isBiometryAvailable(): Promise<{ available: boolean; type: 'fingerprint' \| 'face' \| 'none' }>` | 생체인증 하드웨어/등록 상태 확인 |

---

## 네이티브 구현 상세 (핵심: CryptoObject 패턴)

### SecureKeyManager.kt
- 별도 마스터 키 `kiyo_secure_master_key` 생성 (자동완성용 `kiyo_master_key`와 분리)
- 설정: `setUserAuthenticationRequired(true)`, `BIOMETRIC_STRONG`, **30분 인증 캐시**
- `setInvalidatedByBiometricEnrollment(true)` — 생체인증 재등록 시 키 무효화

### BiometricAuthHelper.kt (핵심 구현)
- **`@aparajita/capacitor-biometric-auth` 사용 안 함** — Android `BiometricPrompt` + `CryptoObject` 직접 사용
- **암호화/복호화 모두** `Cipher.init()` → `CryptoObject(cipher)` → `BiometricPrompt.authenticate(cryptoObject)` 패턴 사용

#### 저장 (storeKey) 흐름:
```kotlin
// 1. Cipher 초기화 (ENCRYPT_MODE) — 이 시점에 아직 인증 안 함
val cipher = Cipher.getInstance("AES/GCM/NoPadding")
cipher.init(Cipher.ENCRYPT_MODE, masterKey)

// 2. CryptoObject로 감싸서 BiometricPrompt에 전달
val cryptoObject = BiometricPrompt.CryptoObject(cipher)
biometricPrompt.authenticate(promptInfo, cryptoObject)

// 3. 인증 성공 콜백에서 cipher.doFinal()로 실제 암호화 수행
override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
    val cipher = result.cryptoObject.cipher
    val ciphertext = cipher.doFinal(plainKeyBytes)  // IV + ciphertext + GCM tag
    // DataStore에 저장
}
```

#### 복호화 (unlockKeyWithBiometric) 흐름:
```kotlin
// 1. 저장된 암호화 데이터 읽기 (IV 추출)
val encrypted = readEncryptedKeyFromDataStore()
val iv = encrypted.iv

// 2. Cipher 초기화 (DECRYPT_MODE) with IV
val cipher = Cipher.getInstance("AES/GCM/NoPadding")
val spec = GCMParameterSpec(128, iv)
cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)

// 3. CryptoObject로 감싸서 BiometricPrompt에 전달
val cryptoObject = BiometricPrompt.CryptoObject(cipher)
biometricPrompt.authenticate(promptInfo, cryptoObject)

// 4. 인증 성공 콜백에서 cipher.doFinal()로 실제 복호화 수행
override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
    val cipher = result.cryptoObject.cipher
    val plainKeyBytes = cipher.doFinal(encrypted.ciphertext)
    // base64 인코딩 후 React로 반환
}
```

> **핵심**: `setUserAuthenticationRequired(true)`인 키는 암호화/복호화 **모두** 사용자 인증이 필요함. `CryptoObject` 패턴으로 Cipher를 인증 흐름에 바인딩해야 함.

### SecureKeyPlugin.kt
- `@CapacitorPlugin(name = "SecureKey")`
- 위 5개 메서드 `@PluginMethod`로 노출
- 코루틴(`Dispatchers.IO`)으로 비동기 처리
- `suspendCancellableCoroutine`으로 BiometricPrompt 콜백 브릿지

---

## React 연동 흐름

### 1. 최초 설정 (Settings → 생체인증 ON)
```
SecuritySection.tsx: "생체인증 사용" 토글 ON
  → "생체인증을 등록합니다" 안내 → 생체인증 프롬프트 (storeKey 내부에서 호출)
  → useSessionStore.getState().cryptoKey (메모리)
  → SecureKeyPlugin.storeKey({ vaultId: activeFileName, key: cryptoKeyBase64 })
  → 네이티브: Cipher.init(ENCRYPT) → BiometricPrompt(CryptoObject) → 인증 성공 → cipher.doFinal() → DataStore 저장
  → settingsStore.biometricEnabled = true
```

### 2. 생체인증 로그인 (Auth.tsx)
```
Auth.tsx: "생체인증으로 로그인" 클릭
  → SecureKeyPlugin.hasKey({ vaultId: activeFileName }) → true 확인
  → SecureKeyPlugin.unlockKeyWithBiometric({ vaultId: activeFileName })
  → 네이티브: DataStore에서 암호화 키 읽기 → Cipher.init(DECRYPT, IV) → BiometricPrompt(CryptoObject) → 인증 성공 → cipher.doFinal() → base64 cryptoKey 반환
  → React: base64 → CryptoKey 변환 → setupVaultSession() → navigate('/accounts')
```

### 3. 잠금/파일 변경 시 동작

| 액션 | React 메모리 cryptoKey | SecureKey 저장소 |
|------|----------------------|------------------|
| `lockDataFile()` (일반 잠금) | **제거** (`clearCryptoKey()`) | **유지** |
| `closeDataFile()` (파일 닫기) | 제거 | 유지 |
| 앱 종료/프로세스 죽음 | 소멸 | 유지 |
| 생체인증 OFF (설정에서 끄기) | 제거 | **삭제** (`deleteKey()`) |
| Vault 삭제 | 제거 | **삭제** (`deleteKey()`) |
| 다른 Vault 전환 | 제거 | 기존 Vault 키 삭제/새 Vault 키 저장 |
| PIN 변경 | 재생성 | 정책에 따라 biometric key 재생성 |

> **핵심**: 메모리의 세션 키와 Keystore에 저장된 생체인증 키는 **서로 다른 lifecycle**을 가짐

---

## 기존 코드 변경 사항

| 파일 | 변경 내용 |
|------|-----------|
| `src/plugins/kiyosecurekey.ts` | 신규: `registerPlugin('SecureKey')` 래퍼 + 웹 폴백 |
| `Auth.tsx` | 생체인증 버튼 + `SecureKeyPlugin.unlockKeyWithBiometric()` 호출 로직 추가 |
| `SecuritySection.tsx` | 생체인증 토글 + 최초 설정(`storeKey`) / 해제(`deleteKey`) 로직 추가 |
| `fileStorage.ts` | `lockDataFile()`, `closeDataFile()`에서 **`deleteKey()` 호출 안 함** (메모리만 정리) |
| `settingsStore.ts` | `biometricEnabled` persist에 포함 (필드 이미 존재) |
| `capacitor.config.ts` | 로컬 플러그인은 별도 등록 불필요 (네이티브 `@CapacitorPlugin`으로 자동 인식) |

---

## 검증 체크리스트

- [ ] `npx cap sync android` 후 Android 빌드 성공
- [ ] `npm run typecheck` 통과
- [ ] 실기기: PIN 로그인 → 설정에서 생체인증 ON (생체인증 1회 수행) → 앱 종료 → 재실행 → 생체인증 로그인 성공
- [ ] 일반 잠금(`lockDataFile`) 후 생체인증 로그인 가능 확인 (30분 캐시 내)
- [ ] 30분 경과 후 생체인증 재요구 동작 확인
- [ ] 생체인증 OFF → 키 삭제 확인 → 생체인증 로그인 불가 (PIN만 가능)
- [ ] Vault 삭제/전환 시 생체인증 키 초기화 동작 확인
- [ ] 웹 폴백: `isBiometryAvailable()` → `{available: false}` 반환, 버튼 숨김

---

## 구현 순서

1. **네이티브**: `SecureKeyManager.kt`, `BiometricAuthHelper.kt` (CryptoObject 패턴), `SecureKeyPlugin.kt` 작성
   - `Cipher.init()` → `CryptoObject` → `BiometricPrompt.authenticate()` 한 흐름이 핵심
2. **TypeScript**: `kiyosecurekey.ts` 래퍼 + 웹 폴백 작성
3. **UI**: `Auth.tsx` 생체인증 버튼, `SecuritySection.tsx` 토글 추가
4. **연동**: `fileStorage.ts` 잠금 로직 수정 (deleteKey 제거), `settingsStore` persist 확인
5. **테스트**: `npm run check`, 실기기 통합 테스트

---

## 중요 설계 원칙

```
① lockDataFile() → deleteKey() 하지 않음
   └─ 일반 잠금과 biometric credential 삭제를 분리

② master key는 절대로 JS로 나오지 않음
   └─ native Keystore 안에만 존재, BiometricPrompt + CryptoObject → Cipher → Keystore native 흐름

③ 30분 인증 캐시는 Android Keystore 레벨에서 처리
   └─ React에서 타이머 관리 안 함, UserNotAuthenticatedException으로 자동 유도

④ storeKey() / unlockKeyWithBiometric() 모두 CryptoObject 패턴 사용
   └─ 암호화/복호화 모두 인증 필요, Cipher를 인증 흐름에 바인딩

⑤ storeKey() 시 생체인증 프롬프트 의도적으로 포함
   └─ 사용자가 실제 생체인증 1회 확인 후 등록되는 UX
```