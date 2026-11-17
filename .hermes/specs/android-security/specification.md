# Specification — 안드로이드 네이티브 보안 (Android Native Security)

**상태**: Draft (최초 작성)  
**경로**: `.hermes/specs/android-security/specification.md`  
**관련 헌법**: `CONSTITUTION.md` §5 보안 규칙, §8 헌법 위반 체크리스트  
**연계 스펙**: `.hermes/specs/security/specification.md` (React/WebView 측 보안)  
**적용 범위**: `android/app/src/main/java/com/kiyo/app/security/`, `android/app/src/main/java/com/kiyo/app/securekey/`

---

## Goal

안드로이드 네이티브 측의 Android Keystore 키 관리, SQLCipher DB 암호화, 생체인증 보안 규칙을 단일 진실 공급원으로 명시하고, React 측 보안 스펙과 연계하여 전체 시스템의 보안 일관성을 보장한다.

---

## Context / Assumptions

### 현재 상태 (Current State)

| 항목 | 현황 | 소스 |
|------|------|------|
| Keystore 키 #1 | `kiyo_master_key` — Autofill SQLCipher DB의 DB_KEY 래핑/언래핑용 | `KeystoreManager.kt` `LEGACY_KEY_ALIAS` |
| Keystore 키 #2 | `kiyo_secure_master_key` — 생체인증 볼트 키 보호용 | `BiometricAuthHelper.kt` `KEY_ALIAS` |
| 인덱스 키 | `kiyo_index_master_key` — 비인증 인덱스 암호화용 (Keystore 비인증 키) | `KeystoreManager.kt` `INDEX_KEY_ALIAS` |
| SQLCipher DB | Autofill 계정 저장, DB_KEY(AES-256)로 암호화 | `AutofillRepository.kt` |
| 생체인증 키 | 단일 글로벌 키 (볼트별 키 아님), 메모리 캐시 | `SecureKeyManager.kt` |
| 생체인증 흐름 | BiometricPrompt + CryptoObject, GCM 태그 검증 실패 시 재등록 유도 | `BiometricAuthHelper.kt` |
| 키 래핑 | AES-GCM으로 DB_KEY/인덱스 키/생체 볼트 키를 Keystore 키로 래핑 | `EncryptedKey` 데이터 클래스 |
| 네트워크 | AndroidManifest에 인터넷 권한 미부여 | `AndroidManifest.xml` |

### 전제 조건 (Assumptions)

1. 타겟 플랫폼은 Android (API 26+)이며, Capacitor 브리지를 통해 React WebView와 통신한다.
2. Android Keystore는 하드웨어 backed 키 저장을 지원하는 기기에서만 사용 가능하며, 미지원 기기에서는 소프트웨어 백업으로 폴백할 수 있다.
3. Keystore에 저장되는 키는 평문이 아닌 하드웨어/TEE 보호 아래의 키 자료(key material)이다.
4. React 측 `cryptoKey`와 Android 측 Keystore 키는 별도이며, Capacitor 브리지를 통해 키 자료가 직접 전달되지 않는다.
5. 네트워크 전송은 전혀 발생하지 않음 (오프라인 전용).

### 미정 사항 (Open Questions — 추측하지 않음)

- [ ] 생체인증 실패 후 재시도 제한 횟수 및 락아웃 정책 (현재는 BiometricPrompt 기본 동작 의존)
- [ ] 앱 프로세스 종료 시 SecureKeyManager의 메모리 캐시된 키 즉시 삭제 여부
- [ ] 기기 변경/초기화 시 Keystore 키 마이그레이션 또는 재생성 정책

---

## Functional Requirements (기능 요구사항)

### AFR-1: Keystore 키 분리

**Given** 안드로이드 네이티브 측에서 두 개의 Keystore 키가 사용된다  
**When** `kiyo_master_key`와 `kiyo_secure_master_key`를 확인한다  
**Then** 두 키는 별도 별칭(alias)으로 보호되어야 하며, autofill DB_KEY와 biometric vault 키가 혼용되어서는 안 된다

### AFR-2: SQLCipher DB_KEY Keystore 래핑

**Given** Autofill SQLCipher DB의 DB_KEY가 생성되거나 회전된다  
**When** `DatabaseKeyManager`가 `KeystoreManager`를 통해 키를 보호한다  
**Then** DB_KEY는 `kiyo_master_key`로 AES-GCM 래핑되어 저장되며, Keystore 없이 DB_KEY 평문에 접근할 수 없어야 한다

### AFR-3: 생체인증 키 보호

**Given** 생체인증 볼트 키가 생성되거나 사용된다  
**When** `SecureKeyManager`가 `KeystoreManager`와 `BiometricAuthHelper`를 통해 키를 보호한다  
**Then** 생체인증 볼트 키는 `kiyo_secure_master_key`로 AES-GCM 래핑되며, 생체인증 성공 시에만 언래핑 가능해야 한다

### AFR-4: 생체인증 단일 글로벌 키

**Given** 생체인증 키가 관리된다  
**When** 여러 볼트에 대해 생체인증이 수행된다  
**Then** 생체인증 키는 단일 글로벌 키이어야 하며, 볼트별 별도 키는 생성되지 않아야 한다

### AFR-5: 생체인증 실패 처리

**Given** 생체인증 인증이 실패한다  
**When** `BiometricAuthHelper.unlockKeyWithBiometric`가 AEADBadTagException을 던지거나 인증 거부 응답을 받는다  
**Then** 잘못된 키 자료는 메모리에 남겨두지 않아야 한다

### AFR-6: 키 래핑 암호화 강도

**Given** DB_KEY, 인덱스 키, 생체인증 볼트 키를 Keystore 키로 래핑한다  
**When** `EncryptedKey` 데이터 클래스에 IV + ciphertext(GCM tag 포함)를 저장한다  
**Then** AES-GCM 알고리즘을 사용하며, GCM 태그 검증 실패 시 위조/변조된 데이터로 간주해야 한다

### AFR-7: 비인증 인덱스 키

**Given** `kiyo_index_master_key`가 사용된다  
**When** 인덱스 검색이 필요하다  
**Then** `kiyo_index_master_key`는 사용자 인증 없이 접근 가능한 비인증(non-auth) Keystore 키이어야 하며, 민감 데이터(계정 비밀번호 등) 보호에 사용되어서는 안 된다

### AFR-8: 네트워크 완전 차단

**Given** 안드로이드 앱이 실행 중이다  
**When** 어떤 코드 경로에서 네트워크 요청을 시도한다  
**Then** AndroidManifest에 `android.permission.INTERNET`이 선언되어 있지 않아야 하며, 네트워크 라이브러리(OkHttp, Retrofit 등) 의존성이 추가되어서는 안 된다

### AFR-9: 민감 정보 로깅 금지

**Given** Keystore 작업 또는 생체인증 과정에서 에러가 발생한다  
**When** `Log.e`, `Log.d` 등의 로그 출력이 사용된다  
**Then** 키 자료, PIN, ciphertext 등 민감 정보는 로그에 출력되지 않아야 한다 (에러 메시지/코드만 출력)

### AFR-10: 기기 변경/초기화 시 Keystore 키 재생성

**Given** 사용자가 기기를 변경하거나 공장 초기화를 수행한다  
**When** 새 기기에서 기존 Keystore 키(`kiyo_master_key`, `kiyo_secure_master_key`)에 접근할 수 없다  
**Then** 새로운 Keystore 키를 재생성하고, 사용자가 PIN/생체인증을 다시 설정하여 볼트에 접근할 수 있어야 한다. 기존 키 마이그레이션은 시도하지 않음.

---

## Non-Functional Requirements (비기능적 요구사항)

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **보안** | Keystore 키 별도 분리 (`kiyo_master_key` vs `kiyo_secure_master_key`) | 코드 리뷰, 별칭 상수 확인 |
| **보안** | DB_KEY는 Keystore로 래핑, 평문 미노출 | `DatabaseKeyManager` 단위 테스트 |
| **보안** | 생체인증 키는 `kiyo_secure_master_key`로 래핑 | `SecureKeyManager` 단위 테스트 |
| **보안** | 생체인증 실패 시 재등록 유도, 키 자료 미잔류 | `BiometricAuthHelper` 예외 처리 테스트 |
| **보안** | AndroidManifest에 인터넷 권한 없음 | 정적 분석, 빌드 검증 |
| **보안** | 민감 정보 로그 미출력 | 코드 리뷰, 로그 호출 모킹 테스트 |
| **성능** | Keystore 작업은 비동기 또는 스레드 풀에서 수행 | ANR 방지, 측정 |
| **호환성** | API 26+ Keystore 기능 사용, 하드웨어 미지원 시 소프트웨어 백업 | 기기 테스트 |
| **오프라인** | 네트워크 없이 모든 인증/암호화 기능 동작 | 네트워크 차단 상태에서 E2E 테스트 |

---

## Out of Scope (명시적 제외)

다음 항목은 본 안드로이드 보안 스펙의 범위에 포함하지 않는다.

1. **React/WebView 측 `cryptoKey` 관리**: 이는 `.hermes/specs/security/specification.md`의 FR-1~FR-9에 포함.
2. **생체인증 UI/UX 세부사항**: BiometricPrompt 다이얼로그 디자인, 콜백 타이밍 등은 별도 UI 스펙.
3. **React ↔ Android Capacitor 브리지 인터페이스**: 이는 `plugins/kiyautofill.ts`, `SecureKeyPlugin` 등의 별도 스펙.
4. **클라우드 동기화 / 백업 서버**: 모든 데이터는 기기 로컬에만 저장.
5. **iOS / 데스크톱 / 웹 단독 실행**: 타겟은 Android만.

---

## Acceptance Criteria (수락 기준)

- [ ] **AC-1**: `kiyo_master_key`와 `kiyo_secure_master_key`는 별도 Keystore 별칭으로 보호됨 (코드 리뷰)
- [ ] **AC-2**: DB_KEY는 `kiyo_master_key`로 AES-GCM 래핑되어 저장되며, Keystore 없이 평문 접근 불가 (단위 테스트)
- [ ] **AC-3**: 생체인증 볼트 키는 `kiyo_secure_master_key`로 AES-GCM 래핑됨 (단위 테스트)
- [ ] **AC-4**: 생체인증 키는 단일 글로벌 키이며, 볼트별 키 미생성 (코드 리뷰)
- [ ] **AC-5**: 생체인증 실패 시 재등록 안내, 키 자료 미잔류 (단위/통합 테스트)
- [ ] **AC-6**: 키 래핑 시 AES-GCM 사용, GCM 태그 검증 실패 시 위조 데이터로 간주 (단위 테스트)
- [ ] **AC-7**: `kiyo_index_master_key`는 비인증 Keystore 키이며 민감 데이터 보호에 미사용 (코드 리뷰)
- [ ] **AC-8**: AndroidManifest에 `android.permission.INTERNET` 선언 없음 (정적 분석)
- [ ] **AC-9**: Keystore/생체인증 에러 로그에 키 자료/PIN/ciphertext 미노출 (코드 리뷰 + 테스트)
- [ ] **AC-10**: `npm run check` 통과, Android 변경 시 `npx cap sync android` 실행
- [ ] **AC-11**: 헌법 §8 위반 체크리스트 전 항목 통과 (안드로이드 네이티브 측 적용)

---

### Open Questions (미결정 사항)

없음. 모든 항목 결정 완료.

---

## 연계: React 측 보안 스펙과의 경계

| 경계 지점 | React 측 (`.hermes/specs/security/specification.md`) | 안드로이드 측 (본 스펙) |
|-----------|------------------------------------------------------|------------------------|
| PIN → 키 유도 | PBKDF2 100k → AES-GCM-256 (`cryptoKey`) | 미사용 (Keystore 키 직접 사용) |
| 키 저장 | 메모리만, 디스크 미persist | Android Keystore (하드웨어/TEE) |
| 볼트 암호화 | 볼트 전체 단일 AES-GCM | SQLCipher DB AES-256 (DB_KEY) |
| 생체인증 | 미사용 | `kiyo_secure_master_key` 보호 |
| 네트워크 | fetch/XHR 금지 | AndroidManifest 인터넷 권한 미부여 |

Capacitor 브리지를 통해 키 자료가 React ↔ Android 간에 직접 전달되어서는 안 된다. 각 계층은 자체 키 관리 범위를 가진다.

---

## 구현-스펙 차이점 (구현 전 확인 필요)

| 항목 | 스펙 요구사항 | 현재 구현 | 상태 |
|------|-------------|---------|------|
| 네트워크 차단 | AndroidManifest에 `android.permission.INTERNET` 선언 없음 | 권한 제거 완료 (구현과 일치) | ✅ 해결됨 |


