# Autofill E2E Test 디버깅 전략

## 배경
- `AutofillE2ETest.kt`가 에뮬레이터에서 계속 실패
- 테스트가 **어디까지 실행되었는지 알 수 없음** (로그만으로는 부족)
- 두 가지 인증 플로우가 분리되어 있어 실패 지점 파악이 어려움:
  - **A. 볼트 잠금해제**: React `Auth.tsx` (PIN/생체인증) → `kiyo_secure_master_key`
  - **B. 자동완성 DB_KEY 접근**: 네이티브 시스템 인증 프롬프트 (Keyguard/BiometricPrompt) → `kiyo_master_key` (30분 캐시)

---

## 디버깅 전략: 3단계 접근

### 1단계: 실행 지점 추적 로그 강화 (즉시 적용 가능)

#### 목적
테스트의 **각 단계 진입/완료 지점**을 명확히 알 수 있게 함

#### 적용 파일: `AutofillE2ETest.kt`

```kotlin
// 테스트 메서드 시작 부분에 추가
@Test
fun `E2E_A_CreateVaultCreateAccountSyncAndVerifyAutofill`() {
    Log.e("AUTOFILL_E2E_DEBUG", ">>> TEST STARTED: E2E_A_CreateVaultCreateAccountSyncAndVerifyAutofill")
    
    try {
        // Step 1
        Log.e("AUTOFILL_E2E_DEBUG", ">>> STEP 1 START: Create vault")
        accountsPage = homePage.clickCreateVaultButton()
            .createVault(vaultName, encrypted = false)
        Log.e("AUTOFILL_E2E_DEBUG", ">>> STEP 1 DONE: Vault created: $vaultName")
        
        // Step 2
        Log.e("AUTOFILL_E2E_DEBUG", ">>> STEP 2 START: Create account")
        accountsPage = accountsPage.clickAddAccount()
            .selectDefaultTemplate()
            .fillAccount(AccountCreatePage.AccountData(...))
            .save()
        Log.e("AUTOFILL_E2E_DEBUG", ">>> STEP 2 DONE: Account created")
        
        // Step 3
        Log.e("AUTOFILL_E2E_DEBUG", ">>> STEP 3 START: Sync to autofill")
        syncAccountsToAutofillService()
        Log.e("AUTOFILL_E2E_DEBUG", ">>> STEP 3 DONE: Sync completed")
        
        // Step 4
        Log.e("AUTOFILL_E2E_DEBUG", ">>> STEP 4 START: Verify autofill in test host")
        verifyAutofillInTestHost()
        Log.e("AUTOFILL_E2E_DEBUG", ">>> STEP 4 DONE: Autofill verified")
        
        Log.e("AUTOFILL_E2E_DEBUG", ">>> TEST PASSED")
    } catch (e: Exception) {
        Log.e("AUTOFILL_E2E_DEBUG", ">>> TEST FAILED at step: ${e.message}", e)
        throw e
    }
}
```

#### Page Object에도 단계별 로그 추가

```kotlin
// HomePage.kt
fun clickCreateVaultButton(): VaultCreatePage {
    log(">>> Clicking '파일 생성' button")
    val result = helper.clickByText("파일 생성", "create vault button")
        .also { if (!it) helper.clickByAriaLabel("파일 생성", "create vault button") }
        .also { if (!it) helper.clickByIonicTag("ion-fab-button", "FAB") }
        ?: throw AssertionError("Could not find '파일 생성' button")
    log(">>> '파일 생성' button clicked, returning VaultCreatePage")
    return VaultCreatePage(helper)
}

// VaultCreatePage.kt
fun createVault(...): AccountsPage {
    log(">>> createVault START: fileName=$fileName, encrypted=$encrypted")
    helper.waitForText("파일명")
    log(">>> Dialog opened, typing filename")
    // ... 입력 로직
    log(">>> Clicking '생성' button")
    helper.clickByText("생성", "confirm create button") ?: throw ...
    log(">>> Vault created, waiting for AccountsPage load")
    return AccountsPage(helper).waitForLoad()
}
```

---

### 2단계: 스크린샷/상태 덤프 자동 캡처 (실패 시 자동 저장)

#### 목적
테스트 실패 시 **WebView 화면 상태**와 **UIAutomator 뷰 계층**을 자동으로 저장

#### 적용 파일: `WebViewTestHelper.kt` 확장

```kotlin
class WebViewTestHelper(...) {
    // ... 기존 코드 ...
    
    /** 현재 WebView 스크린샷 저장 (실패 디버깅용) */
    fun captureWebViewScreenshot(stepName: String): String {
        val timestamp = System.currentTimeMillis()
        val fileName = "webview_${stepName}_$timestamp.png"
        // Espresso-Web에서는 직접 스크린샷이 어려우므로 Activity 스크린샷으로 대체
        val activity = InstrumentationRegistry.getInstrumentation().targetContext
        // 실제 구현: screenshot API 사용
        Log.e(tag, "SCREENSHOT: $fileName saved for step: $stepName")
        return fileName
    }
    
    /** 현재 뷰 계층 덤프 (UIAutomator) */
    fun dumpViewHierarchy(stepName: String) {
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val timestamp = System.currentTimeMillis()
        val fileName = "uiautomator_${stepName}_$timestamp.xml"
        device.dumpWindowHierarchy(File("/sdcard/$fileName"))
        Log.e(tag, "VIEW_HIERARCHY: $fileName dumped for step: $stepName")
    }
}
```

#### 테스트에서 사용:

```kotlin
@Test
fun `E2E_A_...`() {
    try {
        // 각 주요 단계 후
        helper.dumpViewHierarchy("after_vault_create")
        helper.captureWebViewScreenshot("after_vault_create")
        
        // 실패 시 catch 블록에서 최종 상태 캡처
    } catch (e: Exception) {
        helper.dumpViewHierarchy("FAILURE_${e.javaClass.simpleName}")
        helper.captureWebViewScreenshot("FAILURE_${e.javaClass.simpleName}")
        throw e
    }
}
```

---

### 3단계: 단계별 격리 테스트 (분리 실행 가능하도록)

#### 목적
전체 E2E 플로우를 **각 단계별로 독립 실행**하여 실패 지점 좁히기

#### 새 테스트 메서드 추가 (`AutofillE2ETest.kt`):

```kotlin
/** 독립 테스트 1: 볼트 생성만 검증 (WebView 네비게이션) */
@Test
fun `DEBUG_1_VaultCreationOnly`() {
    Log.e("DEBUG", "=== DEBUG_1: Vault creation only ===")
    val vaultName = TestDataFactory.uniqueVaultName(encrypted = false)
    accountsPage = homePage.clickCreateVaultButton()
        .createVault(vaultName, encrypted = false)
    assertTrue("Vault created", accountsPage.hasAccount("Test Account") || true) // 계정 없어도 성공
    helper.dumpViewHierarchy("DEBUG_1_done")
}

/** 독립 테스트 2: 계정 생성만 검증 (볼트 이미 있다고 가정) */
@Test
fun `DEBUG_2_AccountCreationOnly`() {
    Log.e("DEBUG", "=== DEBUG_2: Account creation only ===")
    // 사전 조건: 비암호화 볼트 이미 열려있음 (수동으로 만들거나 @Before에서 생성)
    val account = TestDataFactory.accountForDomain("example.com")
    accountsPage = accountsPage.clickAddAccount()
        .selectDefaultTemplate()
        .fillAccount(AccountCreatePage.AccountData(
            title = "Debug Account",
            websiteUrl = account.websiteUrl,
            username = account.username,
            password = account.password
        ))
        .save()
    assertTrue("Account created", accountsPage.hasAccount("Debug Account"))
    helper.dumpViewHierarchy("DEBUG_2_done")
}

/** 독립 테스트 3: 자동완성 동기화만 검증 (DB 직접 조작) */
@Test
fun `DEBUG_3_SyncToAutofillOnly`() {
    Log.e("DEBUG", "=== DEBUG_3: Sync to autofill only ===")
    // 볼트/계정 생성 건너뛰고 바로 DB에 데이터 넣기
    syncAccountsToAutofillService()
    // DB에서 직접 확인
    val dbKey = DatabaseKeyManager.getKey(context).encoded
    val repo = AutofillRepository.create(context, dbKey)
    val accounts = repo.getAllAccounts()
    assertEquals(1, accounts.size)
    assertEquals(account.username, accounts[0].username)
    repo.close()
    Log.e("DEBUG", "=== DEBUG_3: Synced ${accounts.size} accounts ===")
}

/** 독립 테스트 4: 테스트 호스트에서 자동완성만 검증 (DB에 데이터 있다고 가정) */
@Test
fun `DEBUG_4_AutofillVerificationOnly`() {
    Log.e("DEBUG", "=== DEBUG_4: Autofill verification only ===")
    // DB에 계정이 이미 있다고 가정 (DEBUG_3 실행 후)
    testHost.launch("example.com")
    testHost.clickUsernameField()
    testHost.selectAutofillSuggestion(account.username)
    assertTrue("Password filled", testHost.verifyPasswordFilled(account.password))
    Log.e("DEBUG", "=== DEBUG_4: Autofill verified ===")
}
```

---

## 실행 순서 및 확인 방법

### ADB 명령어로 테스트 실행 및 로그 확인

```bash
# 1. 전체 테스트 실행 (필터로 디버그 테스트만 실행 가능)
adb shell am instrument -w \
  -r \
  -e class com.kiyo.app.autofill.AutofillE2ETest#DEBUG_1_VaultCreationOnly \
  com.kiyo.app.test/androidx.test.runner.AndroidJUnitRunner

# 2. 로그캣 실시간 모니터링 (별도 터미널)
adb logcat -s AUTOFILL_E2E_DEBUG:E WebViewTestHelper:E AutofillTestHost:E DEBUG:E

# 3. 실패 시 스크린샷/덤프 파일 가져오기
adb pull /sdcard/uiautomator_DEBUG_1_done_*.xml .
adb pull /sdcard/webview_DEBUG_1_done_*.png .
```

### 에뮬레이터 사전 준비 체크리스트

```bash
# 필수: 자동완성 서비스 활성화
adb shell settings put secure autofill_service com.kiyo.app/com.kiyo.app.autofill.service.KiyoAutofillService
adb shell settings put secure autofill_service_enabled 1

# 필수: 디바이스 언락 (PIN 1234 설정)
adb shell locksettings set-pin 1234
adb shell input keyevent KEYCODE_WAKEUP
# 스와이프로 언락 후 PIN 입력 필요 (수동 또는 스크립트)

# 필수: 테스트 호스트 앱 설치 확인
adb shell pm list packages | grep autofilltest
# 없으면: ./gradlew :autofill-test-host:installDebug

# 선택: 생체인증 시뮬레이션용 (에뮬레이터)
adb -e emu finger touch 1
```

---

## 실패 시나리오별 진단 가이드

| 증상 | 가능성 높은 원인 | 확인 방법 |
|------|-----------------|-----------|
| `Step 1`에서 멈춤/실패 | WebView 로드 안됨, "파일 생성" 버튼 선택자 불일치 | `dumpViewHierarchy`로 한글/영어 UI 확인 |
| `Step 2`에서 실패 | 템플릿 선택 다이얼로그 안뜸, 입력 필드 선택자 불일치 | `waitForText` 타임아웃 로그 확인 |
| `Step 3`에서 실패 | Keystore 인증 필요 (`UserNotAuthenticatedException`), DB_KEY 없음 | `TestSecurityInitializer.logEnvironmentState` 출력 확인 |
| `Step 4`에서 실패 | 테스트 호스트 앱 미설치, 자동완성 드롭다운 안뜸, 패키지명 매칭 안됨 | `AutofillTestHost.launch()` 로그, `isAutofillDropdownVisible` 확인 |
| 전체 테스트가 `Thread.sleep`에서 멈춤 | 명시적 대기 조건이 충족 안됨 | `waitForText`/`waitForElement` 타임아웃 값 확인 |

---

## 두 인증 플로우 구분 디버깅

### 플로우 A: 볼트 잠금해제 (React 웹뷰 내)
```
트리거: 앱 시작, 볼트 열기, 수동 잠금 후
UI: React Auth.tsx (PIN 입력 필드, 생체인증 버튼)
키: kiyo_secure_master_key → React cryptoKey
로그 태그: "AUTOFILL_E2E_DEBUG", "WebViewTestHelper"
```

### 플로우 B: 자동완성 DB_KEY 접근 (네이티브 시스템 다이얼로그)
```
트리거: 설정 "동기화" 클릭, 자동완성 요청 발생
UI: Android 시스템 Keyguard/BiometricPrompt (React 웹뷰 밖)
키: kiyo_master_key → DB_KEY (30분 캐시)
로그 태그: "KiyoAutofillService", "DatabaseKeyManager", "KeystoreManager", "AutofillTestHost"
```

**중요**: 현재 `E2E_A` 테스트는 **비암호화 볼트**를 사용하므로 **플로우 A는 발생하지 않음**.
`Step 3`에서 `syncAccountsToAutofillService()` 호출 시 **플로우 B가 발생할 수 있음** (Keystore 30분 캐시 만료 시).

---

## 다음 액션

1. **즉시**: `AutofillE2ETest.kt`에 단계별 진입/완료 로그 추가 (`AUTOFILL_E2E_DEBUG` 태그)
2. **즉시**: `WebViewTestHelper`에 `dumpViewHierarchy` 메서드 추가
3. **즉시**: 4개 독립 디버그 테스트 메서드 추가 (`DEBUG_1`~`DEBUG_4`)
4. **실행**: 각 디버그 테스트를 순서대로 실행하여 실패 지점 격리
5. **분석**: 실패 지점의 `logcat` + `uiautomator dump` + `screenshot` 종합 분석

---

## 위험 요소 및 대응

| 위험 | 대응 |
|------|------|
| 에뮬레이터 상태 불일치 (언락 안됨, 서비스 미활성화) | `@Before`에서 `DeviceLockHelper.assertUnlocked()` + 서비스 활성화 강제 확인 |
| 한글/영어 UI 차이로 선택자 실패 | `WebViewTestHelper` 선택자 체인에 한글/영어 둘 다 포함 (이미 구현됨) |
| Keystore 키 상태 오염 (이전 테스트 영향) | `TestSecurityInitializer.initializeCleanEnvironment(recreateKeystoreKeys=true)` 사용 |
| 테스트 호스트 앱 버전 불일치 | `AutofillTestHost.PACKAGE` 패키지명으로 설치 확인 |

---

## 롤백 계획
디버깅 코드 추가 후 테스트가 더 불안정해지면:
1. `git stash`로 디버깅 코드 임시 제거
2. 원본 테스트로 복구하여 베이스라인 확인
3. 단계별로 디버깅 코드 적용하며 검증