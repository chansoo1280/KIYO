# Specification — Autofill (자동완성)

**상태**: Draft (최초 작성)
**경로**: `.hermes/specs/autofill/specification.md`
**관련 헌법**: `CONSTITUTION.md` §5 보안 규칙, §8 헌법 위반 체크리스트
**연계 스펙**: `.hermes/specs/security/specification.md` (React 측 보안), `.hermes/specs/android-security/specification.md` (Android Keystore/생체인증)
**적용 범위**: `android/app/src/main/java/com/kiyo/app/autofill/`, `android/app/src/main/java/com/kiyo/app/capacitor/`, `src/plugins/kiyautofill.ts`, `src/plugins/kiyautofill.web.ts`

---

## Goal

KIYO 앱의 Android AutofillService 기반 자동완성 기능 요구사항을 단일 진실 공급원으로 명시한다.
React WebView 측의 볼트 데이터와 Android 네이티브 측의 AutofillService/SQLCipher DB 간 계정 동기화, 필드 탐지·매칭, FillResponse 구성, 인증 흐름을 포함한다.

무엇을(What)만 정의하며, 어떻게(How)는 Plan 단계(.hermes/plans/)에서 다룬다.

---

## Context / Assumptions

### 현재 상태 (Current State)

| 항목 | 현황 | 소스 |
|------|------|------|
| AutofillService | Android `AutofillService` 구현, `onFillRequest`/`onSaveRequest` 처리 | `KiyoAutofillService.kt` |
| 필드 탐지 | WebView/View 노드 탐지, autofillHints·htmlAutocomplete 기반 스코어링, OTP 음성 신호, 신규가입 보너스 | `FieldDetector.kt`, `FieldScorer.kt`, `FieldScoringRules.kt`, `HtmlAttributeExtractor.kt`, `ViewNodeExtractor.kt` |
| 도메인 매칭 | 와일드카드 서브도메인, 패키지명 접두사 매칭, 대소문자/포트/www 정규화, `findBestMatch` 통합 점수 | `DomainMatcher.kt` |
| 인증 | `UserNotAuthenticatedException` → BiometricPrompt/PIN 폴백 → 재요청, auth 캐시 (debug 30s / release 30분) | `KiyoAutofillService.kt` (인증 처리 인라인), `FillResponseBuilder.kt` |
| 계정 동기화 | React 측 볼트 계정 → Android SQLCipher DB 동기화, 보안 다운그레이드 시 리셋 | `AutofillSyncManager.kt`, `AutofillRepository.kt` |
| Capacitor 브리지 | `KiyoAutofillPlugin` (TS 정의), `AutofillPlatformBridge` (OS 능력 추상화), 웹 폴백 | `kiyautofill.ts`, `kiyautofill.web.ts`, `AutofillPlatformBridge.kt` |
| 키 보호 | `kiyo_master_key` (Autofill DB_KEY 래핑), `DatabaseKeyManager` (DataStore alias 포인터 + 암호화 블롭) | `KeystoreManager.kt`, `DatabaseKeyManager.kt` |
| 네트워크 | AndroidManifest에 인터넷 권한 미부여, fetch/XHR 금지 | `AndroidManifest.xml` |

### 전제 조건 (Assumptions)

1. 타겟 플랫폼은 Android (API 26+)이며, Capacitor 브리지를 통해 React WebView와 통신한다.
2. Android AutofillService는 시스템 수준의 자동완성 프레임워크로, 사용자가 시스템 설정에서 KIYO 서비스를 활성화해야 동작한다.
3. React 측 `cryptoKey`(PIN→PBKDF2→AES-GCM)와 Android 측 Keystore 키(`kiyo_master_key`)는 별도이며, Capacitor 브리지를 통해 키 자료가 직접 전달되지 않는다.
4. Autofill SQLCipher DB의 DB_KEY는 `kiyo_master_key`로 AES-GCM 래핑되어 보호된다. Keystore 없이 DB_KEY 평문에 접근할 수 없다.
5. 네트워크 전송은 전혀 발생하지 않음 (오프라인 전용).
6. `syncAutofillToken()`은 deprecated/no-op이며, 순수 Keystore 기반 인증만 사용한다.
7. Autofill용 계정 데이터는 React 볼트와 Android SQLCipher DB 간에 동기화되며, 동기화는 React → Android 단방향 또는 수동 트리거 기반이다.

---

## Functional Requirements (기능 요구사항)

각 요구사항은 테스트 가능한 Given/When/Then 형식으로 작성한다.

### AFR-1: AutofillService 활성화 상태 조회

**Given** 사용자가 Android 시스템 설정에서 Autofill 서비스를 구성한다  
**When** React 측이 `isAutofillEnabled()`를 호출한다  
**Then** `AutofillStatus`에 `enabled`, `hasService`, `isOurService`, `isEnabled`, `hasEnabledServices`, `servicePackageName`, `serviceClassName`이 정확히 반영되어야 한다

### AFR-2: Autofill 설정 화면 열기

**Given** 사용자가 앱 내에서 Autofill 활성화를 요청한다  
**When** Autofill 설정 화면 열기가 요청된다  
**Then** Android 시스템 Autofill 설정 화면이 열려야 하며, 사용자가 KIYO 서비스를 선택할 수 있어야 한다

### AFR-3: 필드 탐지 (Field Detection)

**Given** WebView 또는 네이티브 앱의 로그인/회원가입 폼이 표시된다  
**When** `FieldDetector`가 입력 필드 후보를 스캔한다  
**Then** 다음 신호를 기반으로 사용자명/비밀번호 필드를 탐지해야 한다:
- `autofillHints` (username, password 등)
- `htmlAutocomplete` (username, current-password, new-password, email 등)
- `htmlInputType` (email, password, text 등)
- 클래스명/ID 기반 폴백 (낮은 가중치)

**Given** `htmlAutocomplete=one-time-code` (OTP 필드)  
**When** 사용자명 점수 계산이 수행된다  
**Then** OTP 음성 신호(`SCORE_OTP_NEGATIVE`)가 적용되어 사용자명 후보에서 제외되어야 한다

### AFR-4: 도메인/패키지 매칭

**Given** 웹사이트 도메인 또는 Android 앱 패키지명이 주어진다  
**When** `DomainMatcher.findBestMatch()`가 호출된다  
**Then** 다음 규칙에 따라 계정을 매칭해야 한다:
- 와일드카드 서브도메인 (`*.example.com` → `api.example.com` 등)
- 패키지명 접두사 매칭 (`com.example.app` ↔ `com.example.app.beta`)
- 도메인 정규화 (소문자 변환, `www.` 제거, 포트 제거)

### AFR-5: FillResponse 구성

**Given** 매칭된 계정이 하나 이상 존재한다  
**When** AutofillService가 `FillResponse`를 구성한다  
**Then** `FillResponseBuilder`/`DatasetFactory`를 통해 데이터셋이 생성되며, 인증이 필요한 경우 `createAuthResponse()`로 생체인증/ PIN 프롬프트 데이터셋을 반환해야 한다

### AFR-6: 생체인증 / PIN 인증 흐름

**Given** DB_KEY 접근에 인증이 필요한 상태(`UserNotAuthenticatedException`)  
**When** FillResponse에 auth 데이터셋이 포함되어 사용자가 인증 프롬프트를 본다  
**Then** 생체인증 성공 시 즉시 재요청, 실패/취소 시 PIN/패턴 폴백, 인증 후 stale auth 상태가 남지 않아야 한다

**Given** 성공적인 인증 후 auth 캐시가 유효한 상태  
**When** 동일한 세션 내 재요청이 발생한다  
**Then** 추가 프롬프트 없이 캐시된 인증으로 처리되어야 한다 (캐시 유효시간: debug 30초 / release 30분)

### AFR-7: 계정 동기화 (React → Android SQLCipher)

**Given** React 측 볼트 계정 데이터가 변경된다  
**When** 계정 동기화가 요청된다  
**Then** `AutofillSyncManager`가 보안 다운그레이드 확인 → 리포지토리 초기화 → 보안 업그레이드 플래그 확인 → 보안 키 획득(필요 시 재래핑) → `AutofillRepository`를 통한 SQLCipher DB 동기화 순서로 수행해야 한다

**Given** 동기화 중 `UserNotAuthenticatedException`이 발생한다  
**When** 인증이 필요하다  
**Then** pending sync를 저장하고 인증 액티비티를 실행하며, 인증 결과에 따라 재시도 또는 `authRequired=true` 응답을 반환해야 한다

### AFR-8: 보안 다운그레이드 / 업그레이드 처리

**Given** Keystore 키가 무효화(KPInvalidated)되거나 보안 다운그레이드가 감지된다  
**When** `resetAutofillData()`가 호출된다  
**Then** 마스터 키 + DB_KEY 블롭 + SQLCipher DB 파일이 삭제되고, 새로운 alias로 fresh wrapping이 즉시 커밋되어야 한다. 구 wrapping 복구는 시도하지 않는다.

### AFR-9: 네트워크 완전 차단

**Given** Autofill 관련 어떤 코드 경로에서 네트워크 요청을 시도한다  
**Then** 요청은 차단되어야 하며, AndroidManifest에 `android.permission.INTERNET`이 선언되어 있지 않아야 한다. OkHttp/Retrofit 등 네트워크 라이브러리 의존성이 추가되어서는 안 된다.

### AFR-10: 민감 정보 로깅 금지

**Given** Autofill 처리 중 에러가 발생한다  
**When** `Log.e`, `Log.d` 등의 로그 출력이 사용된다  
**Then** 키 자료, PIN, 계정 비밀번호, ciphertext 등 민감 정보는 로그에 출력되지 않아야 한다 (에러 메시지/코드만 출력)

### AFR-11: 계정 저장 (onSaveRequest)

**Given** 사용자가 앱 또는 웹의 로그인 폼에서 사용자명과 비밀번호를 입력하고 저장한다  
**When** Android 시스템이 `onSaveRequest`를 호출한다  
**Then** `KiyoAutofillService`가 사용자명/비밀번호 필드를 탐지하고, 자격 증명을 추출하여 SQLCipher DB에 계정을 upsert한 후 `callback.onSuccess()`를 호출해야 한다

**Given** `onSaveRequest` 처리 중 `UserNotAuthenticatedException`이 발생한다  
**When** DB_KEY 접근에 인증이 필요하다  
**Then** `SaveCallback`은 auth UI를 지원하지 않으므로 `callback.onSuccess()`를 조용히 호출하고 인증 프롬프트를 표시하지 않아야 한다

**Given** 사용자명 또는 비밀번호 중 하나를 추출할 수 없다  
**When** `onSaveRequest`가 실행된다  
**Then** 계정을 저장하지 않고 조용히 종료해야 한다

**Given** 저장 대상 앱의 패키지명이 `com.kiyo.app` (KIYO 앱 자체)이다  
**When** `onSaveRequest`가 실행된다  
**Then** 저장 작업을 스킵하고 종료해야 한다

---

## Non-Functional Requirements (비기능적 요구사항)

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **보안** | `kiyo_master_key`(Autofill DB_KEY)와 `kiyo_secure_master_key`(생체인증) 별도 별칭 보호 | 코드 리뷰, 별칭 상수 확인 |
| **보안** | DB_KEY는 Keystore로 래핑, 평문 미노출 | `DatabaseKeyManager` 단위 테스트 |
| **보안** | 키 자료는 Capacitor 브리지를 통해 React ↔ Android 간 직접 전달 금지 | 코드 리뷰, 브리지 인터페이스 검토 |
| **보안** | `syncAutofillToken()` deprecated/no-op, 순수 Keystore 기반 인증만 사용 | 코드 검토, 테스트 |
| **보안** | AndroidManifest에 인터넷 권한 없음 | 정적 분석, 빌드 검증 |
| **보안** | 민감 정보 로그 미출력 | 코드 리뷰, 로그 호출 모킹 테스트 |
| **성능** | 필드 탐지 스코어링은 WebView 노드 수에 선형 비례, 차단 최소화 | 측정 |
| **성능** | auth 캐시 유효시간: debug 30초 / release 30분 | `KeystoreManager` 구현 검토 |
| **호환성** | API 26+ AutofillService API 사용 | 기기/에뮬레이터 테스트 |
| **오프라인** | 네트워크 없이 모든 자동완성 기능 동작 | 네트워크 차단 상태에서 E2E 테스트 |
| **테스트** | crypto/보안 관련 변경 시 통합 테스트 추가 | `npm run check` + androidTest |

---

## Out of Scope (명시적 제외)

다음 항목은 본 Autofill 스펙의 범위에 포함하지 않는다:

1. **React/WebView 측 `cryptoKey` 관리**: `.hermes/specs/security/specification.md` (PIN→PBKDF2→AES-GCM, 키 메모리만) 참조.
2. **Android Keystore 키 관리 세부사항**: `.hermes/specs/android-security/specification.md` (KeystoreManager, DatabaseKeyManager, SecureKeyManager) 참조.
3. **생체인증 UI/UX 세부사항**: BiometricPrompt 다이얼로그 디자인, 콜백 타이밍 등은 별도 UI 스펙.
4. **클라우드 동기화 / 백업 서버**: 모든 데이터는 기기 로컬에만 저장.
5. **iOS / 데스크톱 / 웹 단독 실행**: 타겟은 Android만. iOS Password AutoFill 확장은 `AutofillPlatformBridge`만 새로 구현하고 정책 계층은 재사용하되, 본 스펙에서는 다루지 않음.
6. **필드 스코어링 상수 값 튜닝 세부사항**: `.hermes/plans/2026-08-24-autofill-field-detection.md` 등 별도 계획 문서 참조.

---

## Acceptance Criteria (수락 기준)

본 스펙이 완료됐다고 판단하는 조건. 각 항목은 테스트로 검증 가능해야 한다.

- [ ] **AC-1**: `isAutofillEnabled()`가 정확한 `AutofillStatus` 반환 (JVM 단위 테스트)
- [ ] **AC-2**: `requestAutofillEnable()`/`openAutofillSettings()`가 시스템 설정 화면 호출 (코드 리뷰 + E2E)
- [ ] **AC-3**: OTP 필드(`one-time-code`)가 사용자명 후보에서 제외됨 (JVM 단위 테스트)
- [ ] **AC-4**: 와일드카드 서브도메인, 패키지명 접두사 매칭, 도메인 정규화 동작 (JVM 단위 테스트, DomainMatcherTest 26/26)
- [ ] **AC-5**: 인증 필요 시 `createAuthResponse()`로 생체인증/PIN 프롬프트 데이터셋 반환 (JVM 단위 테스트)
- [ ] **AC-6**: 인증 취소/실패 시 stale auth 상태 미잔류, PIN 폴백 동작 (JVM 단위 테스트 + E2E)
- [ ] **AC-7**: auth 캐시 유효시간 만료 후 재인증 요구 (debug 30s / release 30분, E2E)
- [ ] **AC-8**: React → Android 계정 동기화 정상 수행, 보안 다운그레이드 시 리셋 + fresh re-wrap (JVM + E2E)
- [ ] **AC-9**: KPInvalidated 시 구 wrapping 복구 없이 새 alias로 fresh 커밋 (JVM 단위 테스트)
- [ ] **AC-10**: AndroidManifest에 `android.permission.INTERNET` 선언 없음 (정적 분석)
- [ ] **AC-11**: Keystore/생체인증 에러 로그에 키 자료/PIN/ciphertext 미노출 (코드 리뷰 + 테스트)
- [ ] **AC-12**: `npm run check` (typecheck + test) 통과, Android 변경 시 `npx cap sync android` 실행
- [ ] **AC-13**: 헌법 §8 위반 체크리스트 전 항목 통과 (Autofill 측 적용)

---

## Open Questions (미결정 사항 — 추측하지 않음)

| 항목 | 현황 |
|------|------|
| React → Android 동기화 트리거 시점 | 수동 트리거만 현재 지원. 자동 동기화 주기 또는 이벤트 기반 동기화 여부 미정 |
| 웹/앱 통합 매칭 우선순위 | 도메인 매칭과 패키지명 매칭이 동시에 적용될 때의 우선순위 로직 미정 |
| 다중 볼트 계정 동시 동기화 | 여러 볼트의 계정을 Android SQLCipher DB에 어떻게 병합/분리할지 미정 |

---

## 연계: 보안 스펙과의 경계

| 경계 지점 | React 측 보안 스펙 | Android 네이티브 보안 스펙 | 본 Autofill 스펙 |
|-----------|------------------|------------------------|----------------|
| PIN → 키 유도 | PBKDF2 100k → AES-GCM (`cryptoKey`) | 미사용 (Keystore 키 직접 사용) | 미사용 (Keystore 키 직접 사용) |
| 키 저장 | 메모리만, 디스크 미persist | Android Keystore (하드웨어/TEE) | `kiyo_master_key`로 DB_KEY 래핑 |
| 볼트 암호화 | 볼트 전체 단일 AES-GCM | SQLCipher DB AES-256 (DB_KEY) | SQLCipher DB 저장 |
| 생체인증 | 미사용 | `kiyo_secure_master_key` 보호 | DB_KEY 접근 시 인증 프롬프트 트리거 |
| 네트워크 | fetch/XHR 금지 | AndroidManifest 인터넷 권한 미부여 | 인터넷 권한 미부여, 네트워크 라이브러리 금지 |

Capacitor 브리지를 통해 키 자료가 React ↔ Android 간에 직접 전달되어서는 안 된다. 각 계층은 자체 키 관리 범위를 가진다.

---

## 구현-스펙 차이점 (구현 전 확인 필요)

| 항목 | 스펙 요구사항 | 현재 구현 | 상태 |
|------|-------------|---------|------|
| Bridge 정책 로직 제외 | Bridge는 OS 능력만, 정책은 SyncManager 소관 | `AutofillPlatformBridge` 정의 완료, `AutofillSyncManager` 별도 클래스로 추출 | ✅ 해결됨 |
| fill 요청 추상화 미도입 | `onAutofillRequest`/`FillContext` 추상화 도입 안 함 | `KiyoAutofillService`가 직접 처리, 추상화 미도입 | ✅ 해결됨 |
| `syncAutofillToken()` | deprecated/no-op | 코드베이스에 전혀 존재하지 않음 (검색 결과 0건) | ✅ 해결됨 |
| 네트워크 차단 | AndroidManifest 권한 없음 | 권한 제거 완료 (커밋 `c0ee0e45`) | ✅ 해결됨 |
| AuthRequestHandler | plan 문서(`autofill-auth-ux.md`)에서 별도 컴포넌트 언급 | 실제 파일 없음, `KiyoAutofillService.onFillRequest`에 인라인 처리 | ⚠️ plan 문서와 구현 차이 (스펙 영향 없음) |
| 계정 저장 (`onSaveRequest`) | `onSaveRequest`로 사용자명/비밀번호 추출 → SQLCipher upsert | `KiyoAutofillService.onSaveRequest()` 완전 구현됨 (사용자명/비밀번호 추출, 로그인 폼 판별, SQLCipher upsert) | ✅ 해결됨 |
| FillResponseBuilder / DatasetFactory | 스펙에서 참조 | 실제 파일 존재, `KiyoAutofillService`에서 사용 | ✅ 해결됨 |
