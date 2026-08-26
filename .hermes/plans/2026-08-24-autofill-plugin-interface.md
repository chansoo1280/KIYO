# Plan: Autofill Plugin Interface Clarification (vNext)

**Date:** 2026-08-24 (reviewed 2026-08-25)
**Status:** ✅ 구현 완료 + 검증 통과 (2026-08-25) — 커밋 `329d800c`
**Branch:** `feature/autofill-reliability`
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도
**Topic:** Plugin Interface Clarification

## Goal

Clarify `KiyoAutofillPlugin` responsibilities and define platform abstraction for future iOS expansion.

세 경계를 확정한다:
- **Bridge = OS 능력** (플랫폼 차이 추상화)
- **SyncManager = 동기화 정책** (애플리케이션 정책)
- **Service = 실제 Autofill 처리** (`KiyoAutofillService` — 이번 변경 범위 밖, 향후 Service 추상화는 별도 검토)

## Responsibility Boundary (핵심 원칙)

**Bridge는 플랫폼 차이만 추상화하고, SyncManager는 애플리케이션 정책을 담당한다.**

- **`AutofillPlatformBridge` (OS 의존 기능만)** — "무엇을 할 수 있는가"
  - Android Autofill 활성화 상태 조회 (`AutofillManager` / `Settings.Secure`)
  - Autofill 설정 화면 열기 (Intent)
  - 플랫폼별 데이터 전달 / 플랫폼별 Autofill API 호출
- **`AutofillSyncManager` (애플리케이션 정책)** — "언제/어떻게 할 것인가"
  - DB 키 획득 방법 (`DatabaseKeyManager.getKey()`)
  - 보안 다운그레이드 판단 및 리셋 (`getCurrentAlias()` + `isSecurityDowngrade()` → `resetAutofillData()`)
  - 보안 업그레이드 수행 시점 (`wasSecurityUpgraded()` → 응답 플래그)
  - 리포지토리 초기화 및 sync 위임 순서
  - 인증 필요 시 pending sync 저장 + auth activity 실행/재시도 흐름
- **`KiyoAutofillService` (범위 밖)** — fill 요청(`onFillRequest`) 처리, 필드 탐지, FillResponse 구성은 Service 책임. 이번 리팩터링에서 Bridge로 흡수하지 않는다. `onAutofillRequest` / `FillContext` 같은 fill 요청 추상화는 **도입하지 않는다** — 필요 시 "향후 Service 추상화 검토"로 별도 계획을 세운다.

금지: Bridge 인터페이스에 DB 키 획득, 다운그레이드/업그레이드 판단 등 정책 로직을 노출하지 않는다. iOS 확장 시 Bridge만 새로 구현하면 정책 계층은 그대로 재사용되어야 한다.

## Execution Order (실행 순서)

구현 순서는 아래와 같으며, 변경 번호 순서와 다를 수 있다:

1. `AutofillSyncManager` 추출 (기존 로직 이동 — 동작 변화 없음)
2. 기존 `KiyoAutofillPlugin`이 SyncManager에 위임하는지 확인 (기존 테스트/E2E green)
3. `AutofillPlatformBridge` 도입
4. Android 구현을 Bridge에 연결
5. TypeScript 타입 추가/검증
6. JVM Unit Test + 기존 Plugin Test + E2E 실행

> 중간 상태 금지: SyncManager 추출 전에 Bridge부터 만들면 빈 껍데기를 코드가 참조하는 꼬인 상태가 된다.

## Proposed Changes

### Change A: Extract AutofillSyncManager

**File:** `android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt`

**Component:** `syncAccountsFromReact`
**Change:** Extract sync logic to `AutofillSyncManager` class
**Reason:** Single responsibility; testable without Capacitor

### Change B: Define AutofillPlatformBridge

**File:** `android/app/src/main/java/com/kiyo/app/capacitor/`
**Change:** Define `AutofillPlatformBridge` interface (OS 의존 기능만) + Android implementation
**Reason:** Enable iOS Password AutoFill plugin with same React API

### Change C: TypeScript types

**File:** `src/plugins/kiyautofill.ts`
**Component:** Types
**Change:** Add `AutofillPlatformBridge` type definition
**Reason:** Shared contract between platforms. **TypeScript interface는 Native Plugin API 계약을 표현하기 위한 타입 정의이며, 기존 React 컴포넌트 및 호출 API는 변경하지 않는다.**

## Implementation Details

### AutofillSyncManager Class

현재 `KiyoAutofillPlugin.syncAccountsFromReact()`(KiyoAutofillPlugin.kt:410-462)의 정책 로직을 이동.
> 참고: 현재 코드는 sync 경로에서 `DatabaseKeyManager.getKey()`를 직접 호출하지 않는다 (키 접근은 repository 초기화 및 Keystore 인증 예외 경로에서 발생). getKey()를 임의로 추가하지 않는다.

순서:
1. 보안 다운그레이드 확인 (`DatabaseKeyManager.getCurrentAlias()` + `isSecurityDowngrade()`) → `resetAutofillData()` 후 fresh key로 진행
2. 리포지토리 초기화 보장 (`ensureRepositoryInitialized()`)
3. 보안 업그레이드 플래그 확인 (`DatabaseKeyManager.wasSecurityUpgraded()`) → 응답에 `securityUpgrade` 반영
4. `AutofillRepository.syncAccountsFromReact()` 위임
5. `UserNotAuthenticatedException` 발생 시 pending sync 저장 → auth activity 실행 → 결과에 따라 재시도 (`handleAuthResult` 흐름도 함께 이동)

Will be injected into `KiyoAutofillPlugin` for easy testing

### AutofillPlatformBridge Interface

OS 의존 기능만 노출한다 (정책 로직 포함 금지 — 위 Responsibility Boundary 참조).

- Define methods that need to be implemented per platform:
  - `isAutofillEnabled(): AutofillStatus` (활성화 상태 조회)
  - `openAutofillSettings(): Unit` (설정 화면 열기)
  - `deliverAccountsForAutofill(accountsJson: String): Unit` (플랫폼별 데이터 전달 — 정책 없는 순수 전달)
- Android implementation will delegate to existing system APIs (`AutofillManager`, `Settings.Secure`, Intent)
- Future iOS implementation will use Password AutoFill APIs
- Note: 동기화 "정책"(다운그레이드 리셋, 키 획득, 업그레이드 감시, 인증 재시도)과 fill 요청 처리(Service 소관)는 Bridge 메서드에 나타나지 않는다. iOS 확장 시 Bridge만 교체하고 정책 계층(AutofillSyncManager)은 재사용한다.

## Security Invariants (보안 불변성)

DB 키 소유권(DatabaseKeyManager), Keystore 보호(`kiyo_master_key`), 인증 실패 동작(UserNotAuthenticatedException → auth activity), 암호화 정책은 **변경하지 않는다**. 이번 변경은 호출 경로와 책임 분리만을 목적으로 하며, 테스트를 위해 보안 클래스의 생성자/시그니처를 수정하지 않는다.

## Tests

### 테스트 인프라 (현황)

- JVM 유닛 테스트: Robolectric 4.11 + MockK 1.13.13 + kotlinx-coroutines-test 사용 가능 (`app/build.gradle`)
- `src/test/java/com/kiyo/app/capacitor/KiyoAutofillPluginTest.kt` **존재 확인** — 현재 smoke 테스트 2개(인스턴스화, load)만 있음 → 위임 검증으로 확장 대상
- 참고 구현: `AuthRequestHandlerTest.kt`, `DomainMatcherTest.kt` 등 동일 스택 선례

### 제약 사항

- **`DatabaseKeyManager`는 `object`(싱글톤)** — 주입이 아니라 MockK `mockkObject`로 격리한다. 보안 클래스(DatabaseKeyManager, KeystoreManager)의 생성자/시그니처는 테스트를 위해 변경하지 않는다.
- Auth activity 실행 부분(`authActivityLauncher.launch`)은 Capacitor ActivityResultLauncher 의존 → 인터페이스(예: `SyncAuthNavigator`)로 추출해 fake로 대체하거나, 해당 시나리오는 androidTest/E2E로 검증한다.

### Unit Tests (JVM) - New Test File

**Test File:** `android/app/src/test/java/com/kiyo/app/capacitor/AutofillSyncManagerTest.kt` (NEW FILE)
**Scenarios to Add:**
- Sync when security downgrade detected → resetAutofillData() called, fresh key로 sync 진행
- Sync when auth-required key expired → throws UserNotAuthenticatedException → pendingSync 저장 + auth activity 실행 요청
- 인증 성공 결과 수신 → pending sync 재시도 성공 (`handleAuthResult` OK 경로)
- 인증 취소/실패 결과 수신 → authRequired=true 응답으로 resolve (`handleAuthResult` cancel 경로)
- Sync with valid key → repository initialized and syncAccountsFromReact called
- Sync includes securityUpgrade flag in response
- Error handling during repository initialization

### Existing Tests

- `KiyoAutofillPluginTest.kt` (**존재 확인됨**) — 기존 smoke 테스트 유지 + plugin이 AutofillSyncManager에 위임하는지 검증하는 테스트 추가
- No changes needed to React unit tests as the React API remains unchanged

### E2E 회귀 (Android)

- `npm run test:e2e:android:fast` (APK 재사용)로 리팩터링 후 sync 경로 회귀 확인:
  - `autofillEnableSyncAndFill_unencryptedVault_noAuth` — React→Native sync 정상 동작 검증
  - `resyncAfterDeviceCredentialAdded_authRequired` — Keystore 인증/재래핑 흐름 회귀 검증
- 에뮬레이터 환경이 없으면 manual verification으로 대체하고 그 사실을 기록한다.

## Verification Structure (Test File by Test File)

| Test File | Type | Scenarios to Pass | Status |
|-----------|------|-------------------|--------|
| `AutofillSyncManagerTest` | JVM Unit (Robolectric+MockK) | **NEW FILE** - downgrade → reset, auth-required → pendingSync, 인증 성공/취소 재시도 경로, valid key → sync called, securityUpgrade flag, init error handling | ✅ Pass (2026-08-25, 7/7 green) |
| `KiyoAutofillPluginTest` | JVM Unit | 기존 smoke 2개 유지 + AutofillSyncManager 위임 검증 추가 | ✅ Pass (2026-08-25, 3/3 green) |
| `kiyautofill.ts` (TypeScript) | Compile Check (`npm run typecheck`) | TypeScript definitions compile without errors; `AutofillPlatformBridge` interface defined; React API 변경 없음 | ✅ Pass (2026-08-25) |
| Android Autofill E2E | Instrumented (`npm run test:e2e:android:fast`) | noAuth fill + authRequired 재동기화 두 시나리오 모두 통과 — sync 경로 회귀 없음 확인 | ✅ Pass (2026-08-25, 사용자 확인 완료) |

**Pass Criteria:** All test files in this table must pass (green) for this plan to be complete. E2E는 에뮬레이터 필요 — 실행 불가 시 manual verification 결과를 문서에 기록하고 이유를 명시한다.

## Risks and Mitigations

| Risk | Impact | Mitigation | Verified By |
|------|--------|------------|-------------|
| Extraction breaks existing sync flow | Autofill data not updated from React | Comprehensive unit tests + manual verification | `AutofillSyncManagerTest` valid-key 시나리오 + E2E noAuth |
| Lifecycle risk: pendingSync/auth-retry flow breaks during move (coroutine scope 변경, launcher 등록 시점 변화) | 인증 필요 상황에서 sync 실패 또는 무응답 | pendingSync 상태·재시도 로직을 그대로 이동(scope/launcher 등록은 load() 시점 유지); scope 변경 시 coroutine finally/cancel 보장 검토 | `AutofillSyncManagerTest` 인증 성공/취소 시나리오 + E2E `resyncAfterDeviceCredentialAdded_authRequired` |
| Platform abstraction over-engineered | Unnecessary complexity | Keep interface minimal (3개 메서드), fill 요청 추상화 미도입 | Code review at implementation |
| TypeScript/Java contract mismatch | Build/runtime errors | Shared definitions, compile-time checking | `npm run typecheck` |

## Dependencies

- No changes to core autofill logic (service, repository, detection)
- No changes to security classes (DatabaseKeyManager, KeystoreManager)
- Changes are localized to plugin layer and TypeScript definitions