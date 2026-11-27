# Specification — 보안 (Security)

**상태**: Draft (최초 작성)  
**경로**: `.hermes/specs/security/specification.md`  
**관련 헌법**: `CONSTITUTION.md` §5 보안 규칙, §8 헌법 위반 체크리스트  
**적용 범위**: `src/` 전체 (React WebView + Zustand + Dexie + Web Crypto API)

---

## Goal

KIYO 앱의 모든 보안 규칙(키 관리, 암호화, 세션, 자동 잠금, 네트워크 차단)을 단일 진실 공급원으로 명시하고, 구현/테스트/리뷰 시 헌법을 위반하지 않도록 가이드한다.

---

## Context / Assumptions

### 현재 상태 (Current State)

| 항목 | 현황 | 소스 |
|------|------|------|
| 암호화 알고리즘 | PBKDF2 (100k iterations, SHA-256) → AES-GCM-256 | `src/crypto/encryption.ts` `createCryptoKey` |
| 볼트 암호화 단위 | 볼트 전체(JSON 직렬화) 1회 AES-GCM 암호화 | CONSTITUTION §4 |
| 키 저장 위치 | `cryptoKey`는 메모리(SecuritySession/Zustand)만, 디스크 미저장 | `src/store/sessionStore.ts` `partialize` |
| 디스크 persist | `fileName`, `salt`만 localStorage persist (Zustand `partialize`) | `src/store/sessionStore.ts` |
| 설정 저장 | 테마/폰트/자동잠금 등은 localStorage에 평문 | `src/store/settingsStore.ts` |
| 자동 잠금 | `none` / `1m` / `10m` / `30m`, 활동 감지 시 리셋 | CONSTITUTION §5 |
| Android Keystore | `kiyo_master_key`(autofill), `kiyo_secure_master_key`(biometric) 분리 | CONSTITUTION §5 |
| 네트워크 | AndroidManifest에 인터넷 권한 미부여, fetch/XHR 금지 | CONSTITUTION §5 |

### 전제 조건 (Assumptions)

1. 타겟 플랫폼은 Android (API 26+) WebView 기반 Capacitor 앱이다.
2. Web Crypto API(`crypto.subtle`)는 secure context (HTTPS/localhost/127.0.0.1 또는 Android WebView)에서만 사용 가능하다.
3. PIN은 사용자가 설정하는 기억식 지식 기반 인증 요소이다 (생체인증은 별도 Keystore 키 보호).
4. 네트워크 전송은 전혀 발생하지 않음 (오프라인 전용).
5. 볼트 파일은 기기 로컬 파일 시스템 / IndexedDB에만 저장되며, 클라우드 동기화는 없다.

---

## Functional Requirements (기능 요구사항)

각 요구사항은 테스트 가능한 Given/When/Then 형식으로 작성한다.

### FR-1: 키 디스크 저장 금지

**Given** 사용자가 볼트를 잠금 해제(unlock)하여 `cryptoKey`가 메모리에 로드된 상태  
**When** Zustand 세션이 localStorage에 persist된다  
**Then** persist되는 상태에는 `cryptoKey`가 포함되지 않아야 하며, `fileName`과 `salt`만 포함되어야 한다

**Given** 앱이 재시작되어 localStorage에서 세션이 복원된다  
**When** `cryptoKey`가 복원된 상태에서 확인한다  
**Then** `cryptoKey`는 `null`이어야 하며, 사용자는 반드시 PIN으로 재해제(unlock)해야 한다

### FR-2: PIN → PBKDF2 → AES-GCM 키 유도

**Given** 사용자가 PIN을 입력하여 볼트를 생성/잠금 해제한다  
**When** `createCryptoKey(pin, salt)`가 호출된다  
**Then** PBKDF2 파라미터는 iterations=100000, hash=SHA-256, 키 길이=256bit, 알고리즘=AES-GCM이어야 한다

**Given** PBKDF2 iterations 값이 100000이 아닌 값으로 변경되려는 시도가 있다  
**When** 코드 리뷰 또는 테스트에서 iterations 상수를 확인한다  
**Then** iterations는 100000 고정이며, 임의 변경이 불가능해야 한다 (헌법 §5)

### FR-3: 볼트 전체 객체 암호화

**Given** `KiyoVaultData` 전체(JSON 직렬화)를 암호화한다  
**When** `encryptData(data, key, salt)`가 호출된다  
**Then** 결과는 단일 AES-GCM 블록(`EncryptedKiyoVaultData`)이며, 개별 Account/Template 레코드 단위 이중 암호화는 수행되지 않아야 한다

### FR-4: 자동 잠금 (Auto-lock)

**Given** 자동 잠금 설정이 `1m` / `10m` / `30m` 중 하나로 설정되어 있다  
**When** 설정된 시간 동안 사용자 활동이 감지되지 않는다  
**Then** 세션이 자동으로 잠금(lock)되어 `cryptoKey`가 메모리에서 제거되어야 한다

**Given** 사용자 활동이 감지된다  
**When** 자동 잠금 타이머가 실행 중이다  
**Then** 타이머가 리셋되어야 한다

**Given** 키가 상실(제거)된다  
**When** 어떤 트리거로든 `cryptoKey`가 `null`이 된다  
**Then** 즉시 잠금 상태가 되어야 하며, 볼트 재해제 시 PIN 재입력이 필요하다

### FR-5: Android Keystore 키 분리

**Given** Android 네이티브 측에서 두 개의 Keystore 키가 사용된다  
**When** `kiyo_master_key`와 `kiyo_secure_master_key`를 확인한다  
**Then** 두 키는 별도 별칭(alias)으로 보호되어야 하며, autofill DB_KEY와 biometric vault 키가 혼용되어서는 안 된다

### FR-6: 네트워크 완전 차단

**Given** 앱이 실행 중이다  
**When** 어떤 코드 경로에서 네트워크 요청(fetch/XHR/websocket)을 시도한다  
**Then** 요청은 차단되어야 하며, AndroidManifest에 인터넷 권한이 선언되어 있지 않아야 한다

### FR-7: 잘못된 PIN 처리 (오류 은폐)

**Given** 사용자가 잘못된 PIN으로 볼트 잠금 해제를 시도한다  
**When** `verifyPin(data, pin)` 또는 `decryptData`가 호출된다  
**Then** 복호화 실패는 일반 예외로 처리되며, 구체적인 실패 이유(PIN 불일치 vs 데이터 손상)를 외부에는 노출하지 않아야 한다 (오라클 방지)

### FR-8: 세션 초기화 및 격리

**Given** 볼트 A를 잠금 해제한 후 볼트 B로 전환한다  
**When** `closeDataFile()` / `unlockFile()`이 호출된다  
**Then** 볼트 A의 계정/템플릿/메타데이터 스토어가 완전히 초기화(reset)되어 볼트 B 데이터와 혼재되지 않아야 한다

### FR-9: 민감 정보 로깅 금지

**Given** 암호화/복호화 과정에서 에러가 발생한다  
**When** `console.error` 또는 로그 출력 경로가 사용된다  
**Then** PIN, salt, cryptoKey, ciphertext 등 민감 정보는 로그에 출력되지 않아야 한다 (에러 메시지만 출력)

---

## Non-Functional Requirements (비기능적 요구사항)

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **보안** | 암호화 키는 메모리만, 디스크 persist 금지 | `sessionStore.partialize` 검토, 테스트로 persist 상태 검증 |
| **보안** | PIN → PBKDF2(100k) → AES-GCM-256 고정 | `encryption.ts` `createCryptoKey` 코드 리뷰 + 단위 테스트 |
| **보안** | 볼트 전체 단일 AES-GCM 암호화 | `encryptData` 출력 형태 검증 |
| **보안** | AndroidManifest에 인터넷 권한 없음 | `android/app/src/main/AndroidManifest.xml` 검토 |
| **보안** | 민감 정보 로그 미출력 | 코드 리뷰, 테스트에서 console 호출 모킹 검증 |
| **성능** | PBKDF2 100k 실행 시 사용자 체감 지연 최소화 (Web Crypto API 사용) | 측정: unlock 시 1초 이내 완료 목표 |
| **성능** | 볼트 암호화/복호화는 메인 스레드 차단 최소화 | async/await 기반 non-blocking |
| **오프라인** | 네트워크 없이 모든 기능(계정 CRUD, 볼트 생성/잠금/해제, 내보내기/가져오기) 동작 | 네트워크 차단 상태에서 E2E/통합 테스트 |
| **암호화 수준** | AES-GCM-256, IV 12바이트, GCM 태그 16바이트 | `encryption.ts` 구현 검토 |
| **암호화 수준** | salt 16바이트, 임의 생성(crypto.getRandomValues) | `encryption.ts` `createCryptoKey` 검토 |

---

## Out of Scope (명시적 제외)

다음 항목은 본 보안 스펙의 범위에 포함하지 않는다. 별도 스펙으로 관리한다.

1. **패스프레이즈(text passphrase) 도입**: PIN 기반 키 유도만 다룸. 패스프레이즈 지원은 STRATEGY.md §6 미결정 사항.
2. **클라우드 동기화 / 백업 서버**: 모든 데이터는 기기 로컬에만 저장. 파일 기반 백업/복원은 별도 기능.
3. **iOS / 데스크톱 / 웹 단독 실행**: 타겟은 Android만.
4. **Autofill 토큰 기반 인증**: `syncAutofillToken()`은 deprecated/no-op이며, 순수 Keystore 기반 인증만 사용.
5. **안드로이드 네이티브 보안 구현 세부사항**: Android Keystore 키 관리, SQLCipher DB 암호화, 생체인증 구현은 `.hermes/specs/android-security/specification.md` 별도 스펙으로 관리. 본 스펙은 React/WebView 측 보안 규칙에 집중.

---

## Acceptance Criteria (수락 기준)

본 스펙이 완료됐다고 판단하는 조건. 각 항목은 테스트로 검증 가능해야 한다.

- [ ] **AC-1**: `sessionStore`의 `partialize`에서 `cryptoKey`가 제외되고 `fileName`/`salt`만 persist됨 (단위 테스트)
- [ ] **AC-2**: 앱 재시작 시 `cryptoKey`는 `null`이며, 사용자가 PIN으로 재해제해야 볼트에 접근 가능 (통합 테스트)
- [ ] **AC-3**: `createCryptoKey`의 PBKDF2 iterations가 100000 고정, hash SHA-256, AES-GCM-256 (단위 테스트)
- [ ] **AC-4**: `encryptData` 결과는 `EncryptedKiyoVaultData` 단일 블록, 개별 레코드 이중 암호화 없음 (단위 테스트)
- [ ] **AC-5**: 자동 잠금 시간 경과 시 `cryptoKey`가 메모리에서 제거되고 앱이 잠금 화면으로 이동 (통합/E2E 테스트)
- [ ] **AC-6**: 활동 감지 시 자동 잠금 타이머 리셋 (단위/통합 테스트)
- [ ] **AC-7**: AndroidManifest에 `android.permission.INTERNET` 선언 없음 (정적 분석/빌드 검증)
- [ ] **AC-8**: 암호화/복호화 에러 로그에 PIN/salt/key/ciphertext 미노출 (코드 리뷰 + 테스트)
- [ ] **AC-9**: 볼트 전환 시 이전 볼트의 계정/템플릿 데이터가 잔류하지 않음 (통합 테스트)
- [ ] **AC-10**: `npm run check` (typecheck + test)가 통과하며, crypto 변경 시 통합 테스트가 추가됨 (CONSTITUTION §6)
- [ ] **AC-11**: 헌법 §8 위반 체크리스트 전 항목 통과

---

## Open Questions (미결정 사항 — 추측하지 않음)

### 결정 완료 (추측 금지)

| 항목 | 결정 내용 | 근거 |
|------|-----------|------|
| PBKDF2 iterations | **100k 유지** (상향 안 함) | 사용자 결정, 헌법 §5 "키 유도 횟수 100k 고정" |
| 자동 잠금 활동 감지 범위 | **사용자 액션(터치/입력 등)만 감지**. 백그라운드→포어그라운드 전환 시 경과 시간에 따라 잠금 여부 결정(시간 내 복귀 시 잠금 안 함, 경과 시 잠금) | 사용자 결정 |
| 볼트 내보내기 시 PIN 재입력 | **불필요** (이미 언락 상태에서 수행) | 사용자 결정 |
| 볼트 내보내기 시 별도 암호 입력 | **필요**. 해당 내보내기 파일의 암호화에 직접 사용되는 cryptoKey 그 자체 | 사용자 결정 |
| 볼트 가져오기 시 PIN 입력 | **필수** (복호화를 위해) | 사용자 결정 |

### 추후 논의 (아직 미정)

없음. 모든 항목 결정 완료.

---

## 참고 문서

- `CONSTITUTION.md` — 프로젝트 헌법, §5 보안 규칙, §8 위반 체크리스트
- `src/crypto/encryption.ts` — `createCryptoKey`, `encryptData`, `decryptData`, `verifyPin`
- `src/crypto/crypto.utils.ts` — `assertCryptoAvailable`, `toBase64`, `fromBase64`
- `src/store/sessionStore.ts` — `SecuritySession`, `partialize`, `clearCryptoKey`, `clearSession`
- `src/store/settingsStore.ts` — 앱 설정 (평문 localStorage)
- `docs/STRATEGY.md` — 베팅 논리, Boundary #3 (PBKDF2 100k는 협상 불가)
- `docs/GLOSSARY.md` — SecuritySession, Vault, Account 정의
- `openwiki/architecture/security-model.md` — 보안 모델 아키텍처

---

## 구현-스펙 차이점 (구현 전 확인 필요)

다음 항목들은 현재 코드베이스 구현과 본 스펙 사이에 차이가 있습니다. 구현 단계에서 스펙에 맞추어 수정하거나, 스펙을 현재 구현에 맞게 정렬해야 합니다.

| 항목 | 스펙 요구사항 | 현재 구현 | 상태 |
|------|-------------|---------|------|
| 네트워크 차단 | AndroidManifest에 `android.permission.INTERNET` 선언 없음 | 권한 제거 완료 (구현과 일치) | ✅ 해결됨 |
|| 자동잠금 백그라운드 처리 | 백그라운드→포어그라운드 시 경과 시간에 따라 잠금 여부 결정 (시간 내 복귀 시 잠금 안 함, 경과 시 잠금) | `useAutoLock.ts`가 절대 시간 비교(`Date.now() - lastActivity`)로 구현. `visibilitychange` 미사용 (사용자 결정: 절대 시간 체크로 충분) | ✅ 절대 시간 방식으로 구현 |
| 볼트 내보내기 별도 암호 | 해당 내보내기 파일의 암호화에 직접 사용되는 cryptoKey 그 자체 입력 필요 | 이미 구현됨 (createEncryptedVault 사용, PIN 선택적, 평문 저장도 가능) | ✅ 해결됨 |

