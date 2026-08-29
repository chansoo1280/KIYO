# Plan: E2E Page Object 일원화 + androidTest 패키지 재구성

**Date:** 2026-08-28
**Branch:** `feature/autofill-reliability`
**Topic:** ① 페이지 식별 텍스트를 해당 Page Object로 귀속, ② `autofill/` 밖에서 쓰이는 testutil/pageobjects를 상위 공용 레이어로 이동 (autofill 전용 유틸만 autofill 아래 유지)

## Goal

- 어떤 페이지인지 판별하는 마커 텍스트("파일을 선택하세요", "KIYO 잠금 해제", "My accounts")는 **그 페이지의 Page Object 안에서만 선언**된다.
- **패키지 구조가 실제 의존 방향과 일치**한다: 생체인증 테스트가 `com.kiyo.app.autofill.*`을 import하지 않는다. 공용 테스트 인프라는 상위 레이어(`pageobjects`, `testutil`)에 두고, 자동완성 전용 유틸만 `autofill/` 아래 남긴다.
- UI 운전(뒤로가기 탈출, 파일변경, PIN 언락)은 그 화면의 Page Object가 담당 — testutil은 오케스트레이션만.

## Current State

### 1. 마커 텍스트 중복 선언

| 리터럴 | 진짜 소유 | 현재 중복 위치 |
|---|---|---|
| `"파일을 선택하세요"` / `"파일 생성"` | Home.tsx | AppScreenState.detect:27 / escape:55 / navigateViaSettings:91, HomePage ×10 |
| `"KIYO 잠금 해제"` | Auth.tsx | AppScreenState.detect:31, E2EEnv:136, HomePage:20, BiometricUnlockE2ETest:206/303, SettingsPage:333 |
| `"My accounts"` | Accounts.tsx | AppScreenState.detect:35, E2EEnv ×4, HomePage ×3, VaultCreateDialog:106, BiometricUnlockE2ETest:227 |

### 2. 책임 침범 + 중복

- `AppScreenState.escapeAuthToFileSelection()` — Auth 화면 UI 운전 (AuthPage 소관)
- `AppScreenState.navigateToFileSelectionViaSettings()` — Settings 화면 UI 운전 (SettingsPage 소관)
- `E2EEnv.unlockLockedEnv()` ≒ `AuthPage.unlockWithPin()` — PIN 언락 코드 복제
- 순환 위험: HomePage(pageobjects) → AppScreenState(testutil) import 이미 존재

### 3. 패키지 위치 오류

현재:
```
com.kiyo.app/
├── autofill/
│   ├── pageobjects/   ← 9개 페이지 객체. biometric 테스트도 사용 ← 위치 거짓말
│   ├── testutil/      ← 6개 중 AutofillTestHost만 자동완성 전용
│   ├── AutofillE2ETest.kt / AutofillE2EPrepareTest.kt
│   └── service|repository|detection|... (프로덕션)
├── biometric/         ← BiometricE2E*가 autofill.testutil/pageobjects를 import
└── testutil/          ← DeviceLockHelper, TestSecurityInitializer (공용 — 정상)
```

사용 실태 (import 검증 완료):
| 유틸 | autofill E2E | biometric E2E | 분류 |
|---|---|---|---|
| `AutofillTestHost` | O (`testHost` 생성자 주입) | O (SettingsPage 생성자 인자로만) | **autofill 전용** |
| `WebViewTestHelper` | O | O | 공용 |
| `DeviceOpsHelper` | O | — (biometric이 미사용, SettingsPage 경유 간접) | 공용 |
| `TestDataFactory` | O | O | 공용 |
| `AppScreenState` | O | O (BiometricE2EPrepareTest) | 공용 |
| `E2EEnv` | O | O | 공용 |
| pageobjects 9개 전부 | O | O (AuthPage, SettingsPage, HomePage, AccountsPage) | 공용 |

`SettingsPage`는 `AutofillTestHost`를 받아 `waitForNativeAuthPrompt` / `inputPinViaKeyEvents`(네이티브 프롬프트 감지·PIN 키코드 입력)에 사용 → pageobjects → autofill 역방향 의존. 이 두 기능은 "네이티브 인증 프롬프트 처리"로 추상화 가능.

## Design (목표 구조)

```
com.kiyo.app/
├── autofill/
│   ├── AutofillE2ETest.kt / AutofillE2EPrepareTest.kt
│   ├── service|repository|detection|... (프로덕션, 무변경)
│   └── testutil/                      ← (삭제 — 전부 e2e로 이동)
├── biometric/
│   ├── BiometricE2EPrepareTest.kt     ← package com.kiyo.app.biometric (변경 없음)
│   └── BiometricUnlockE2ETest.kt
├── e2e/
│   ├── testutil/
│   │   ├── WebViewTestHelper.kt       ← 이동+package 변경
│   │   ├── DeviceOpsHelper.kt         ← 이동+package 변경
│   │   ├── TestDataFactory.kt         ← 이동+package 변경
│   │   ├── DeviceLockHelper.kt        ← com.kiyo.app.testutil에서 통합 이동
│   │   ├── TestSecurityInitializer.kt ← com.kiyo.app.testutil에서 통합 이동
│   │   ├── AppScreenState.kt          ← 이동+package 변경 (detect만 남김)
│   │   ├── NativeAuthPrompt.kt        ← 신규 인터페이스 (디바이스 레벨 프롬프트 처리)
│   │   └── E2EEnv.kt                  ← 이동+package 변경
│   └── pageobjects/
│       ├── BasePage.kt                ← isCurrent() 신규 추상
│       ├── HomePage.kt                ← Home.tsx 마커 선언
│       ├── AuthPage.kt                ← Auth.tsx 마커 + escapeToFileSelection 이관
│       ├── AccountsPage.kt            ← Accounts.tsx 마커
│       ├── AutofillLoginPage.kt       ← 신규! AutofillTestHostActivity 화면 객체
│       ├── SettingsPage.kt            ← navigateToFileSelection 이관
│       ├── AccountCreatePage.kt / AccountEditPage.kt / TemplatePickerDialog.kt / VaultCreateDialog.kt
└── testutil/                          ← (삭제 — DeviceLockHelper, TestSecurityInitializer를 e2e/testutil로 통합)
```

대안으로 `biometric/`도 `e2e/biometric/`로 묶는 방안이 있으나, 테스트 클래스 위치 이동은 실행 스크립트/A(pk) 매핑 회귀 가능성이 있어 **본 플랜 범위에서 제외** (최소 변화 원칙).

### 설정 대안 결정

**확정**: 신규 위치는 `com.kiyo.app.e2e.{testutil,pageobjects}` (패키지명 충돌 없음, 목적 명확). AutofillTestHost도 e2e/testutil로 이동하며 `com.kiyo.app.autofill.testutil` 패키지는 소멸한다.

### NativeAuthPrompt 추상화 (디바이스 레벨 vs 화면 레벨 분리)

`AutofillTestHost`는 두 성격이 섞여 있다:
- **화면 레벨** — 로그인 폼에서 자동완성 요청을 유발하고 드롭다운을 선택: `launch`, `triggerAutofillRequest`, `clickUsernameField`, `selectAutofillSuggestion`, `isAutofillDropdownVisible`, `waitForAutofillDropdown`, `verifyPasswordFilled`
- **디바이스 레벨** — 어떤 앱 위에든 뜨는 네이티브 인증 프롬프트 처리(접근성 트리 비노출이라 키코드 직접 입력): `waitForNativeAuthPrompt`, `inputPinViaKeyEvents`

```kotlin
// com.kiyo.app.e2e.testutil.NativeAuthPrompt.kt
interface NativeAuthPrompt {
    fun waitForNativeAuthPrompt(timeoutMs: Long = 20000): Boolean
    fun inputPinViaKeyEvents(pin: String): Boolean
}
```

- `SettingsPage`가 필요한 것은 디바이스 레벨 2개뿐 → **`SettingsPage(helper, nativeAuthPrompt: NativeAuthPrompt)`로 타입만 좁힘**. 호출부(E2EEnv, 두 E2E 테스트)는 그대로 호스트 구현체 전달.
- 나머지 화면 레벨 메서드는 아래 `AutofillLoginPage` 페이지 객체로 흡수된다.

### AutofillLoginPage 신설 (pageobjects)

`AutofillTestHostActivity`(com.kiyo.autofilltest)를 하나의 화면으로 취급하는 Page Object. AutofillTestHost의 화면 레벨 절반을 이동:

```kotlin
// com.kiyo.app.e2e.pageobjects.AutofillLoginPage
class AutofillLoginPage(device: UiDevice) : BasePage-ish {
    companion object { const val PACKAGE = "com.kiyo.autofilltest" }
    fun launch(domainHint: String = "example.com")     // 기존 launch 본문 이동
    fun triggerAutofillRequest()                        // private → 공개 (launch에서 분리 사용 가능)
    fun clickUsernameField(): UiObject2
    fun selectAutofillSuggestion(username: String)
    fun isDropdownVisible(username: String): Boolean    // isAutofillDropdownVisible
    fun waitForDropdown(username: String, timeoutMs): Boolean
    fun verifyPasswordFilled(expected: String): Boolean // NativeAuthPrompt 구현체 필요(NativeAuth-Prompt 상속)
}
```

- 남은 `AutofillTestHost.kt`: PACKAGE/ACTIVITY 상수 + `NativeAuthPrompt` 구현 + (테스트 클래스가 직접 launch를 부르지 않도록) 위임 최소본만 유지하거나 **파일 삭제 후 `NativeAuthPromptImpl(device)`로 이름 변경** → 확정: 클래스명은 `AutofillTestHost` 유지하되 역할이 "네이티브 프롬프트 처리 + 호스트 실행 엔트리"로 축소됨. 위치는 `e2e/testutil/AutofillTestHost.kt`로 이동(autofill/ 패키지 잔류 해제).
- `BiometricUnlockE2ETest`/`BiometricE2EPrepareTest`는 SettingsPage 주입용으로만 사용하므로 영향 없음.

## Proposed Changes

> 구현 순서: ① 패키지 이동(순수 rename) → ② 마커 귀속/AppScreenState 축소 → ③ 호출부 교체 → ④ 컴파일·E2E. 컴파일은 각 단계 끝마다.

### 1. 패키지 이동 (git mv — diff 노이즈 최소화)

- `autofill/pageobjects/*` (9개) → `e2e/pageobjects/`, package → `com.kiyo.app.e2e.pageobjects`
- `autofill/testutil/*` 전부(6개, AutofillTestHost 포함) → `e2e/testutil/`, package → `com.kiyo.app.e2e.testutil`
  - 이로써 `com.kiyo.app.autofill.testutil` 패키지는 소멸 — 자동완성 테스트의 host 실행 로직도 화면 객체 분리 후 e2e 공용으로 귀속
- `testutil/{DeviceLockHelper, TestSecurityInitializer}.kt` → `e2e/testutil/`, package → `com.kiyo.app.e2e.testutil`
  - 사용처가 E2EEnv(launchAppAndBind의 assertUnlocked, import :16-17)와 AutofillE2EPrepareTest(FQN :77-81)뿐이므로 통합 타당
  - `com.kiyo.app.testutil` 패키지 소멸
- 전 프로젝트 import 갱신:
  - `com.kiyo.app.autofill.pageobjects` → `com.kiyo.app.e2e.pageobjects`
  - `com.kiyo.app.autofill.testutil.(X)` → `com.kiyo.app.e2e.testutil.(X)` (예외 없음 — 호스트 포함 전부 이동)
  - `com.kiyo.app.testutil.(X)` → `com.kiyo.app.e2e.testutil.(X)`
  - 영향 파일: autofill 테스트 2개, biometric 테스트 2개, e2e 내부 파일들
- 스크립트(`run-autofill-e2e.ps1`, `run-biometric-e2e.ps1`)의 `-TestMethod class.method` 지정 및 instrumentation 실행 문자열 확인 — 클래스 FQN은 `com.kiyo.app.autofill.AutofillE2ETest` / `com.kiyo.app.biometric.BiometricUnlockE2ETest`로 불변이므로 원칙 무영향, 단 `-Class` 전체 경로 파라미터 사용 시 grep

### 2. 마커 귀속 (pageobjects)

- `BasePage`: `fun isCurrent(): Boolean = runCatching { helper.waitForText(marker(), SHORT_TIMEOUT) }.getOrDefault(false)`, `protected abstract val marker: List<String>` (복수 마커 OR — Home이 2개)
- `HomePage`: markers = listOf("파일을 선택하세요","파일 생성"); waitForLoad/waitForHomeScreen/ensureHomeScreen/getActiveVaultFileName의 리터럴을 marker 참조로 교체; **`import AppScreenState` 제거**(순환 해소)
- `AuthPage`: marker = "KIYO 잠금 해제"; escapeToFileSelection() 이관(AppScreenState.escapeAuthToFileSelection 본문 그대로, 다이알로그 XPATH 포함)
- `AccountsPage`: marker = "My accounts"
- `SettingsPage`: navigateToFileSelection() 이관(Settings→"파일변경"→"이동"); :333 "KIYO 잠금 해제"는 AuthPage.isCurrent 위임

### 3. AutofillTestHost 분해 (화면 레벨 → AutofillLoginPage)

- `AutofillLoginPage` 신설: launch/triggerAutofillRequest/clickUsernameField/selectAutofillSuggestion/isDropdownVisible/waitForDropdown/verifyPasswordFilled 본문 **그대로 이동** (타임아웃·Thread.sleep 값 보존)
- `AutofillTestHost` 축소: NativeAuthPrompt 구현(waitForNativeAuthPrompt/inputPinViaKeyEvents) + PACKAGE/ACTIVITY 상수만 잔류, e2e/testutil에 위치
- 호출부 교체:
  - `AutofillE2ETest`: `env.testHost.launch(...)` → `env.autofillLogin.launch(...)`, selectAutofillSuggestion 등 전부 page 객체 경유. 단, 프로세스 kill 후 auth dataset 흐름(:190-216)의 `inputPinViaKeyEvents`는 testHost 유지(디바이스 레벨)
  - `E2EEnv.BaseEnv`: `testHost` 필드 유지(네이티브 프롬프트 주입용) + `autofillLoginPage: AutofillLoginPage` 필드 추가(bind에서 재생성)

### 4. AppScreenState/E2EEnv 축소

- `AppScreenState.detect()`는 ①②③ page objects의 isCurrent()만 순서대로(Home→Auth→Accounts) 조합 — 로직/타임아웃 보존
- escape/navigateViaSettings 삭제(AuthPage/SettingsPage가 흡수); State enum 유지
- `E2EEnv.unlockLockedEnv()` 삭제 → `authPage.unlockWithPin(TEST_PIN)`; ensureAccountsList의 리터럴 대기도 page 객체 위임
- `E2EEnv`와 `BaseEnv`의 settingsPage 필드 타입은 그대로(AutofillTestHost 전달 유지)

### 5. 테스트 클래스 클린업

- `BiometricUnlockE2ETest`: 206/303행 `helper.waitForText("KIYO 잠금 해제")` → `authPage.isCurrent()`, 227행 "My accounts" → `accountsPage.waitForLoaded()` (AccountsPage에 기존 waitForLoad 활용)
- `AutofillE2EPrepareTest`: 144행 "My accounts" → AccountsPage 경유; 156행 SettingsPage(helper, env.testHost) 그대로(NativeAuthPrompt로 좁혀진 타입 호환)

### 6. 덤프/캡처 호출 정리 — 실패 자동 캡처로 일원화

현황: `dumpViewHierarchy`/`captureScreen` 호출이 총 **120곳** (WebApp 테스트 4개, pageobjects 7개, testutil 3개)에 흩어져 있다. 대부분 `if (!cond) { dump; capture; throw }` 패턴으로 예외 직전 상태를 찍는데, 이는 **failure watcher(TestWatcher.failed)가 이미 자동 수행**한다 — 이중 캡처이며 성공 경로의 "verified"/"after_sync" 같은 정보성 캡처까지 노이즈다.

원칙:
- **유지**: 각 E2E 테스트 클래스의 `@get:Rule failureWatcher`(TestWatcher)만 덤프/캡처를 수행. 실패 시 스크린샷+계층 덤프가 `FAILURE_<testName>` 이름으로 자동 남는다.
- **삭제**: pageobjects/testutil/E2EEnv 내 모든 dump/capture 호출. 페이지 객체와 유틸은 실패 원인 메시지(AssertionError message)와 log 출력만 책임진다.
- **예외 (정보성 즉시 캡처 유지)**: BiometricPrompt처럼 접근성 트리에 노출되지 않아 failure watcher 시점에는 이미 닫힌 일시적 UI 상태를 기록해야 하는 곳:
  - `SettingsPage.activateAutofillService()`의 `autofill_service_picker` / `autofill_confirm_dialog` (시스템 다이얼로그 — 사라지면 재현 불가)
  - 나머지 전부 삭제

| 파일 | 현재 | 후 |
|---|---|---|
| AutofillE2ETest / PrepareTest | watcher 제외 13곳 | 0 (watcher만) |
| BiometricUnlockE2ETest / PrepareTest | watcher 제외 12곳 | 0 |
| pageobjects 7개 | 57곳 | 4 (picker/confirm_dialog 등 일시적 네이티브 UI만) |
| E2EEnv / AppScreenState | 18곳 | 0 |

실행 시 디버깅이 필요하면 로그카뷰/logcat(`helper.log`)과 AssertionError 메시지로 1차 판단하고, failure watcher 산출물(`FAILURE_*`)을 2차 증거로 사용한다.

## Relevant Files

android/app/src/androidTest/java/com/kiyo/app/ 하위 (위 구조표 참조). 프로덕션 main sourceSet 무변경.

## Tests

1. **컴파일**: `./gradlew :app:compileDebugAndroidTestKotlin`
2. **grep 검증**: `com.kiyo.app.biometric` 폴더 내 `import com.kiyo.app.autofill` == 0건, `com.kiyo.app.autofill.testutil` 및 `com.kiyo.app.testutil` 패키지 참조 == 0건 (전부 e2e.testutil로 이동했으므로)
3. **동작 동일성**: detect 순서(NONE→LOCKED→ACTIVE), 각 waitForText 타임아웃 값 그대로 유지
4. **Android E2E (에뮬레이터)**:
   - `npm run test:e2e:android:fast` — AutofillE2ETest 2단계 + prepare
   - `powershell -File android/run-biometric-e2e.ps1` — BiometricUnlockE2ETest 4 시나리오

## Risks

- **스크립트 FQN 하드코딩**: ps1의 `-TestMethod` 매핑이 잘못 건드리면 실행 자체 실패 → 클래스 위치(autofill/, biometric/) 불변 설계로 원천 차단, 단 구현 후 ps1 내 `ConnectedAndroidTest` 인자 grep 확인
- **package rename diff 폭발**: git mv + sed 일괄 처리해 본문 변경과 분리 — 커밋을 (a) package 이동, (b) 마커 귀속 2개로 분리해 revert 가능성 확보
- **isCurrent 부작용**: helper.waitForText가 예외 던질 수 있음 → runCatching 감싸 false 반환
- **detect 순서 보존 누락 시 회귀**: plain list 화면에서 auth 마커 먼저 찾으면 2s 낭비 누적 — 순서/타임아웃 그대로

## Rollback

커밋 2개 분리 (package 이동 / 마커 귀속). 각각 단독 revert 가능. pageobjects/testutil 디렉토리 자체 이동이라 프로덕션 코드 영향 전무 — src/, android main sourceSet 무관.

## Security

프로덕션 인증/Keystore/DB_KEY 경로 무변경. `NativeAuthPrompt` 추상화는 uiAutomator 차원의 인터페이스 분리일 뿐, Keystore/PIN 처리 로직·순서 변화 없음.
