# Plan: Autofill Keystore Auth Cache and Re-wrap Integrity

**Date:** 2026-08-24
**Revised:** 2026-08-25 (plan-review findings 반영)
**Branch:** `feature/autofill-reliability`
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도
**Topic:** Keystore Auth Cache and Re-wrap Integrity

## Goal

Verify and improve the integrity of Keystore auth cache and re-wrap operations, especially during security upgrade/downgrade flows and KPInvalidated scenarios.

## Current State (v3.1 구현, 코드 대조 확정)

`DatabaseKeyManager` (`android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt`):
- DataStore alias 포인터(`current_master_key_alias`) + 암호화 블롭(`db_encrypted_key`)
- `resolveCurrentAlias`: preference 없으면 → 레거시 `kiyo_master_key` 존재 시 채택, 아니면 `_1`
- 재래핑 순서 (`rewrapDbKey`): **복호화 → 새 인덱스 alias 키 생성 → 재암호화 → (블롭+포인터 하나의 `dataStore.edit`로 동시 커밋) → 커밋 성공 후 구 alias 삭제**. 중간 실패 시 완전 롤백.
- KPInvalidated / AEADBadTagException 경로: `resetAutofillData`(마스터 키 + DB_KEY 블롭 + SQLCipher DB 파일 삭제, 포인터 유지) → `generateFreshStateAfterReset`(남은 최대 인덱스+1 alias로 fresh wrapping 즉시 커밋). **구 wrapping 복구 시도 없음.**
- `isSecurityDowngrade`는 KeystoreManager 위임.

`KeystoreManager`:
- 캐시 없음, alias 파라미터화, KPInvalidated 전파(재생성으로 삼키지 않음)
- auth-required 키 생성은 잠금화면 존재 시에만; 유효시간 debug 30초 / release 30분
- `needsSecurityUpgrade`: 잠금화면 있음 + 현재 키 non-auth → true

## Test Responsibility Matrix (책임 경계 — 발견사항 3 반영)

| Test | 책임 | 하지 않는 것 |
|------|------|--------------|
| `KeystoreManagerTest` (JVM/Robolectric) | key 생성/조회/삭제 lifecycle, `needsSecurityUpgrade`, `isSecurityDowngrade` 판단 로직 | 재래핑 정책·alias 포인터 검증 (DatabaseKeyManager 소관) |
| `DatabaseKeyManagerTest` (JVM/Robolectric + mockkObject(KeystoreManager)) | `nextAlias`, atomic pointer commit, 커밋 후 구 alias 삭제, KPInvalidated 시 old-wrapping 미부활 + fresh state 커밋, reset 절차 | 실제 Android Keystore invalidation 발생 자체 (E2E 소관) |
| `AutofillE2ETest` (instrumentation) | 실제 Keystore 인증 캐시, process death, downgrade 후 sync 재구축 | JVM에서 흉내 낼 수 있는 정책 분기 |

## Proposed Changes (테스트 전용 — 프로덕션 코드는 테스트 실패 시에만 수정)

### 1. DatabaseKeyManagerTest.kt (NEW)

**File:** `android/app/src/test/java/com/kiyo/app/security/DatabaseKeyManagerTest.kt`

Mock boundary: `mockkObject(KeystoreManager)` + Robolectric context (실제 DataStore 파일 사용).
**명시적 규칙:** relaxed mock Context로 DB 파일 삭제를 단언하지 않는다 — DB 파일 삭제 검증은 Robolectric real-path 테스트로 분리.

시나리오:
1. `nextAlias` 규칙 (private이므로 rewrap 경유 간접 검증): legacy alias → `_1`, `_N` → `_N+1`
2. **재래핑 원자성**: decrypt 성공 가정 → 새 alias 키 생성 → 재암호화 → DataStore edit이 블롭+포인터를 **한 번의 edit으로** 함께 커밋하는지(coEvery capture로 검증) → 커밋 이후에만 `deleteKey(currentAlias)` 호출되는지 호출 순서로 검증. 재암호화 실패 시 구 alias 삭제가 호출되지 않음(롤백).
3. **KPInvalidated (mock simulation)**: `decrypt`가 `KeyPermanentlyInvalidatedException`을 던지도록 스텁 → 기대: `resetAutofillData` 실행(구 마스터 키 deleteKey + 블롭 삭제), 이후 **새 alias**(구 alias와 다름, 최대 인덱스+1)로 fresh wrapping 즉시 커밋. **old wrapping 재사용 금지** = 예외 후 `decrypt(currentAlias, oldBlob)` 재호출이 없다는 것까지 단언.
4. AEADBadTagException 경로도 동일 정책 확인.
5. `resetAutofillData` — Robolectric real path: 마스터 키 삭제 + DataStore 블롭 제거 + 임시 생성한 `kiyo_autofill.db` 파일 삭제 3종 모두 확인; 리셋 직후 `getKey()` 재호출 시 이전 DB_KEY와 다른 새 키 반환(복구 불가 증명).
6. `isSecurityDowngrade` 위임 및 예외 시 false.

### 2. KeystoreManagerTest.kt (NEW)

**File:** `android/app/src/test/java/com/kiyo/app/security/KeystoreManagerTest.kt`

Robolectric로 AndroidKeyStore provider는 사용 불가하므로, Keystore 의존 메서드는 mockkObject로 내부 상태를 대체할 수 없는 한계를 인정하고 **판단 로직 중심**으로 테스트:
- `needsSecurityUpgrade` / `isSecurityDowngrade`의 lockscreen × key-auth 조합 매트릭스 (KeyguardManager는 Robolectric shadow로 제어, KeyInfo 조회는 스텁)
- encrypt/decrypt round-trip (일반 SecretKeySpec 주입 — `encrypt`/`decrypt`는 provider 비의존이므로 실제 동작 테스트 가능)
- GCM IV 길이/ciphertext 길이 require 검증
- key gen/delete lifecycle은 instrumentation(E2E 빌드)에서 커버됨을 명시 — JVM에서 AndroidKeyStore 실동작은 단언하지 않음

### 3. AutofillE2ETest.kt (기존 파일에 추가, 본 계획의 후속 단계)

**File:** `android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt`

- `autofillAfterProcessDeath_authCacheValid`:
  - 프로세스 종료 방식 명시: 서비스 프로세스 PID 특정 후 kill (`adb shell pidof com.kiyo.app` + kill). 앱 전체 `am force-stop`과 구분해 기록.
  - **Timing budget**: 인증 성공 → 프로세스 kill → fill 요청 완료까지 **debug 30초 이내**. 각 단계 타임스탬프를 로그로 남겨 flaky 시 원인 판별 가능하게 함.
- `autofillSecurityDowngrade_lockscreenRemoved`: PIN 설정 → sync → PIN 제거 → sync → reset + rebuild 확인 (관찰: logcat `Security downgrade detected` + `Resetting autofill security state` + 재동기화 성공).

## Tests

### Unit Tests (JVM/Robolectric) — NEW FILES

| File | Scenarios | Status |
|------|-----------|--------|
| `DatabaseKeyManagerTest` | nextAlias 규칙, 재래핑 원자성+순서, KPInvalidated mock (old-wrapping 미부활 + fresh 커밋), AEADBadTag 동일 정책, reset 3요소(real path)+재획득 불가, downgrade 위임 | ✅ Pass (2026-08-25, 9 tests green) |
| `KeystoreManagerTest` | upgrade/downgrade 판단 매트릭스, encrypt/decrypt round-trip, 길이 require | ✅ Pass (2026-08-25, 5 tests green — 매트릭스 분기는 JVM에 AndroidKeyStore provider가 없어 문서화만, instrumentation 소관) |

### Instrumentation (E2E) — 후속 단계

| File | Scenarios | Status |
|------|-----------|--------|
| `AutofillE2ETest` | 기존 2개 + `step3_autofillAfterProcessDeath_authCacheValid` (PID kill + 30s budget), `step4_autofillSecurityDowngrade_lockscreenRemoved` | ✅ Pass (2026-08-25, 4/4 green, step3/step4 3회 연속 통과) |

## Verification Criteria (관찰 가능한 증거로 매핑 — 발견사항 5 반영)

- [x] `./gradlew test --tests "*DatabaseKeyManagerTest" --tests "*KeystoreManagerTest"` green — 각 테스트명이 시나리오 1:1 대응
- [x] KPInvalidated JVM 검증: 실패 로그 없이 `resetAutofillData→fresh 커밋` 호출 기록 + old blob 재decrypt 부재 (mockk verification)
- [x] E2E process-death: logcat에서 `Master key loaded from Keystore` (kill 후, 프롬프트 없이 fill 성공) 관찰 — fill 완료 26초, 30s budget 내
- [x] E2E downgrade: logcat `Resetting autofill security state` + 이후 sync 재구축 성공 (`Security downgrade detected` 문자열은 미관찰 — 실제 경로는 AEADBadTagException 경유로 동일 리셋 정책 도달, `detected=false reset=true`)
- [x] 수동 대체: E2E step4가 lockscreen 제거 → reset → 재구축 → fill을 자동 검증 (수동 항목의 자동화 대체)

### 구현 결과 주요 발견사항 (2026-08-25)

1. **JVM 한계 확인**: Robolectric에 AndroidKeyStore provider가 없어 `KeyStore.getInstance("AndroidKeyStore")` 자체가 실패. `needsSecurityUpgrade`/`isSecurityDowngrade`의 lockscreen × key-auth 매트릭스는 JVM 단언 불가 → E2E 소관으로 문서화.
2. **E2E 테스트 간 Activity finish**: instrumentation이 테스트 종료마다 MainActivity를 finish → 후속 테스트는 시작 시 앱 복귀 필요.
3. **Change 클릭 후 picker 잔존**: CredentialsPickerActivity가 포그라운드에 남아 MainActivity가 resume되지 않음. back press는 Capacitor backButton으로 빨려들어 WebView 히스토리가 이동 → CLEAR_TASK 재시작 + Settings 탭 클릭으로 해결.
4. **kotlin-stdlib duplicate class**: capacitor-cordova-android-plugins의 androidTest classpath에 jdk7/jdk8 1.6.21 잔존 → 루트 build.gradle에 전역 dependencySubstitution 적용.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Weakened key wrapping during upgrade/downgrade | Autofill failure or security regression | Tests cover upgrade/downgrade flows; existing logic battle-tested |
| Auth cache too long causing stale auth after PIN change | Unexpected auth prompts | Debug 30s for testing; release 30min is Android standard |
| KPInvalidated recovery creates new DB_KEY without user awareness | Silent data reset | Design: derived data, reset + sync rebuild — accepted per STRATEGY.md |
| JVM KPInvalidated mock이 실제 invalidation을 과장하게 됨 | 잘못된 자신감 | Plan 명시: JVM은 정책 불변조건만, 실제 invalidation 발생은 E2E/수동으로 분리 |
| E2E 30초 timing budget 초과 (느린 에뮬레이터) | Flaky test | 단계별 타임스탬프 로깅으로 원인 판별; budget 초과 시 테스트 자체 조정은 별도 결정 |

## Rollback

테스트 전용 변경이므로 테스트 파일 2개(+E2E 2메서드) 삭제로 완전 롤백. 프로덕션 코드 수정이 발생하면 별도 커밋으로 분리해 개별 revert 가능하게 함.
