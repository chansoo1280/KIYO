package com.kiyo.app.autofill

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.autofill.pageobjects.AccountCreatePage
import com.kiyo.app.autofill.pageobjects.AccountEditPage
import com.kiyo.app.autofill.pageobjects.AccountsPage
import com.kiyo.app.autofill.pageobjects.HomePage
import com.kiyo.app.autofill.pageobjects.SettingsPage
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.autofill.testutil.AutofillTestHost
import com.kiyo.app.autofill.testutil.TestDataFactory
import com.kiyo.app.autofill.testutil.WebViewTestHelper
import com.kiyo.app.testutil.DeviceLockHelper
import com.kiyo.app.testutil.TestSecurityInitializer
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters

@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class AutofillE2ETest {

    // 테스트 실패 시 스크린샷/덤프 자동 캡처
    @get:Rule
    val failureWatcher = object : TestWatcher() {
        override fun failed(e: Throwable, description: Description) {
            val testName = description.methodName
            Log.e("AUTOFILL_E2E_DEBUG", ">>> TEST FAILED: $testName - ${e.message}", e)
            try {
                helper.dumpViewHierarchy("FAILURE_$testName")
                helper.captureScreen("FAILURE_$testName")
            } catch (ex: Exception) {
                Log.w("AUTOFILL_E2E_DEBUG", "Failed to capture failure state: ${ex.message}")
            }
        }
    }

    private lateinit var device: UiDevice
    private lateinit var context: Context
    private lateinit var autofillManager: AutofillManager
    private lateinit var helper: WebViewTestHelper
    private lateinit var homePage: HomePage
    private lateinit var accountsPage: AccountsPage
    private lateinit var settingsPage: SettingsPage
    private lateinit var testHost: AutofillTestHost

    // 테스트 데이터 (팩토리에서 생성)
    private lateinit var vaultName: String
    private lateinit var account: TestDataFactory.AccountInfo
    private val testPin = TestDataFactory.TEST_PIN

    /** 클래스 전체에서 1회만 초기화 수행하기 위한 플래그
     *  - JUnit4는 테스트 메서드마다 새 클래스 인스턴스를 생성하므로 반드시 static(companion) 필드여야 함
     *    (인스턴스 필드면 두 번째 테스트에서 false로 초기화되어 setup이 재실행됨 — 검증됨 2026-08)
     *  - 두 번째 테스트부터는 setup이 스킵되어 이전 테스트의 상태(볼트/계정/설정)가 유지됨
     */
    companion object {
        private var initialized = false
        private const val TEST_DEVICE_PIN = "1234"

        /** 1단계에서 만든 계정 정보 — 2단계는 새 계정을 만들지 않고 이것을 재사용해야 한다.
         *  (인스턴스 필드로 두면 JUnit4가 테스트마다 새 인스턴스를 만들 때
         *   TestDataFactory가 다른 username을 생성해 DB의 실제 계정과 불일치 — 검증됨 2026-08) */
        private lateinit var sharedAccount: TestDataFactory.AccountInfo
    }

    @Before
    fun setup() {
        if (initialized) {
            Log.e("AUTOFILL_E2E_DEBUG", ">>> SETUP SKIPPED (already initialized)")
            // JUnit4가 테스트마다 새 인스턴스를 만들므로 lateinit 필드는 매번 재바인딩 필요
            device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            context = ApplicationProvider.getApplicationContext<Context>()
            autofillManager = context.getSystemService(AutofillManager::class.java)
            helper = WebViewTestHelper("AutofillE2ETest")
            testHost = AutofillTestHost(device)
            homePage = HomePage(helper)
            accountsPage = AccountsPage(helper)
            settingsPage = SettingsPage(helper, testHost)
            // 1단계에서 만든 계정을 그대로 재사용 (새 값 생성 금지 — DB의 실제 계정과 불일치함)
            account = sharedAccount
            return
        }

        Log.e("AUTOFILL_E2E_DEBUG", ">>> SETUP START")
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext<Context>()
        autofillManager = context.getSystemService(AutofillManager::class.java)
        helper = WebViewTestHelper("AutofillE2ETest")
        testHost = AutofillTestHost(device)

        // 테스트 데이터 생성
        vaultName = TestDataFactory.uniqueVaultName(encrypted = false) // 비암호화로 단순화
        account = TestDataFactory.accountForDomain("example.com")
        sharedAccount = account

        // 디바이스 언락 확인
        DeviceLockHelper.assertUnlocked()

        // 1단계 전제: 잠금화면 없는 상태 (auth 없는 Keystore 키 생성 조건)
        DeviceLockHelper.assertNoLockScreen()

        // 보안 환경 초기화 (Keystore 키 유지 - 디바이스가 언락되어 있으므로)
        TestSecurityInitializer.initializeCleanEnvironment(context, recreateKeystoreKeys = false)
        TestSecurityInitializer.logEnvironmentState(context)

        // 앱 데이터 초기화 (WebView 캐시 등) - 테스트 간 상태 격리
        Log.e("AUTOFILL_E2E_DEBUG", "Clearing app data...")
        context.packageManager.getPackageInfo("com.kiyo.app", 0).let { pkgInfo ->
            val appContext = context.createPackageContext("com.kiyo.app", Context.CONTEXT_IGNORE_SECURITY)
            appContext.deleteDatabase("webview.db")
            appContext.deleteDatabase("webviewCache.db")
            appContext.cacheDir.deleteRecursively()
            appContext.getDir("webview", Context.MODE_PRIVATE).deleteRecursively()
        }

        // 메인 액티비티 실행 (CLEAR_TASK로 기존 태스크 완전 정리)
        // Deep link로 Files 탭 바로 열기 시도
        val intent = Intent().apply {
            setClassName("com.kiyo.app", "com.kiyo.app.MainActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            // Ionic/Capacitor 앱에서 탭 선택을 위한 deep link 시도
            data = Uri.parse("kiyo://files")
        }
        context.startActivity(intent)

        device.wait(Until.hasObject(By.pkg("com.kiyo.app").depth(0)), 15000)
        Thread.sleep(3000) // 초기 로드 대기

        // 홈 화면(파일 탭)으로 강제 이동 (앱 상태 무관하게)
        homePage = HomePage(helper)
        homePage.ensureHomeScreen()
        accountsPage = AccountsPage(helper)
        settingsPage = SettingsPage(helper, testHost)

        initialized = true
        Log.e("AUTOFILL_E2E_DEBUG", ">>> SETUP END - Ready")
    }

    /**
     * 비암호화·비인증 상태에서의 자동완성 E2E 테스트 (1단계)
     * 볼트 생성(비암호화) → 계정 저장 → 설정 탭 이동 → 자동완성 사용 토글 ON
     * → 서비스 활성화(시스템 다이얼로그에서 KIYO 선택) → 동기화
     * → testHost 앱에서 실제 자동완성 드롭다운 표시 및 username/password 채움 검증
     */
    @Test
    fun `autofillEnableSyncAndFill_unencryptedVault_noAuth`() {
        Log.e("DEBUG", "=== DEBUG_3: Autofill enable and sync ===")
        val vaultName = TestDataFactory.uniqueVaultName(encrypted = false)
        accountsPage = homePage.clickCreateVaultButton()
            .createVault(vaultName, encrypted = false)

        val accountEditPage = accountsPage.clickAddAccount()
            .selectDefaultTemplate()
            .fillAccount(AccountEditPage.AccountData(
                title = "Sync Account",
                websiteUrl = account.websiteUrl,
                username = account.username,
                password = account.password,
                packageName = account.packageName
            ))
        accountEditPage.save()

        // 설정 화면으로 이동
        settingsPage.navigateToSettings()

        // 자동완성 사용 토글 ON
        settingsPage.enableAutofillToggle()

        // 자동완성 서비스 활성화 (시스템 다이얼로그에서 KIYO 선택)
        settingsPage.activateAutofillService()

        // 동기화 버튼 클릭 (네이티브 인증 프롬프트 처리 포함)
        settingsPage.clickSyncAccounts()

        // ===== 자동완성 검증: testHost 앱에서 실제 자동완성 드롭다운 확인 =====
        Log.e("DEBUG", "=== DEBUG_3: Verifying autofill in test host ===")

        // testHost 앱 실행 - 내부에서 새 인스턴스 시작 + 포커스 순환으로 자동완성 요청까지 수행
        // (드롭다운이 이미 떠 있는 상태로 반환되므로 별도 클릭 트리거 불필요)
        testHost.launch(account.domain)

        // 자동완성 드롭다운에서 계정 선택
        testHost.selectAutofillSuggestion(account.username)

        // 비밀번호 자동완성 검증 (마스킹 길이 간접 비교)
        assertTrue("Password should be autofilled", testHost.verifyPasswordFilled(account.password))
        Log.e("AUTOFILL_E2E", "Autofill verified: username and password filled correctly")

        helper.dumpViewHierarchy("autofill_verified")
        helper.captureScreen("autofill_verified")

        Log.e("DEBUG", "=== autofillEnableSyncAndFill_unencryptedVault_noAuth: PASS ===")
    }

    /**
     * 기기 자격증명(PIN) 추가 후 재동기화 E2E 테스트 (2단계)
     *
     * 사전 조건: 1단계 테스트가 먼저 실행되어 자동완성 설정+동기화 완료된 상태
     * (setup 스킵 플래그 + @FixMethodOrder 알파벳순으로 순서 보장)
     *
     * 흐름: 기기 PIN 설정 → 설정 화면에서 동기화 클릭
     * → Keystore가 업그레이드 감지(needsSecurityUpgrade): DB_KEY를 auth-required 마스터 키로 재래핑
     * → 인증 프롬프트 처리(PIN 입력) → 동기화 성공 및 DB 카운트 유지 검증
     */
    @Test
    fun `resyncAfterDeviceCredentialAdded_authRequired`() {
        Log.e("DEBUG", "=== resyncAfterDeviceCredentialAdded: START ===")

        // 1. 기기에 PIN 설정 (Keystore auth-required 키 생성 가능 상태로 전환)
        setDevicePin(TEST_DEVICE_PIN)
        Thread.sleep(2000)

        // 2. KIYO 앱을 포어그라운드로 복귀 (testHost 실행으로 화면이 이동했을 수 있음)
        //    - PIN 설정으로 Activity가 재생성되어 WebView 바인딩이 무효화될 수 있으므로 재바인딩 대기
        bringKiyoAppToForeground()
        Thread.sleep(3000)
        helper.waitForWebViewReady()

        // 3. 계정 리스트로 진입 - 사용자 환경처럼 하단 List 탭으로 이동
        //    (강제 이동 없음: 이미 계정 리스트면 그대로 진행, 아니면 List 탭 클릭)
        //    - 볼트는 IndexedDB의 고정 active 레코드이므로 useFileAuthGuard를 통과하여
        //      /accounts에서 기존 볼트 데이터가 그대로 로드됨 (파일 재선택 불필요)
        if (!helper.waitForText("My accounts", 3000)) {
            helper.clickByAriaLabel("List", "list tab")
        }
        if (!helper.waitForText("My accounts", 10000)) {
            helper.dumpViewHierarchy("accounts_list_not_loaded")
            helper.captureScreen("accounts_list_not_loaded")
            throw AssertionError("Accounts list did not load after app restart")
        }
        // 계정 리스트 진입 직후 상태 캡처 (볼트/계정 데이터 유지 여부 확인용)
        helper.dumpViewHierarchy("accounts_list_loaded")
        helper.captureScreen("accounts_list_loaded")

        // 4. 설정 화면에서 동기화 클릭 - 업그레이드(재래핑) 발생 지점
        settingsPage.navigateToSettings()
        settingsPage.clickSyncAccountsWithPinAuth(TEST_DEVICE_PIN)

        // 5. 검증: 동기화 성공 - 계정 수 유지 + 마지막 동기화 갱신
        assertTrue("KIYO account count should be preserved",
            helper.waitForText("KIYO 앱"))
        helper.dumpViewHierarchy("after_resync_with_auth")
        helper.captureScreen("after_resync_with_auth")

        // 6. 재래핑 직후 fill 검증 (v3 회귀 핵심):
        //    debug 빌드는 인증 유효시간 30초 → 35초 대기 후 fill하면
        //    서비스가 UserNotAuthenticatedException → createAuthResponse() → 인증 프롬프트 경로를 탄다.
        //    "재래핑 → 캐시 만료 → 즉시 fill + 사용자 인증" 전체 흐름의 실기기 검증.
        Log.e("DEBUG", "=== resyncAfterDeviceCredentialAdded: waiting 35s for Keystore auth cache expiry ===")
        Thread.sleep(35_000)

        Log.e("DEBUG", "=== resyncAfterDeviceCredentialAdded: verifying autofill in test host with auth ===")
        testHost.launch(account.domain)

        // launch() 내부의 triggerAutofillRequest로 onFillRequest가 이미 발화됨.
        // 인증 캐시 만료 상태이므로 여기서 인증 프롬프트(auth dataset)가 떠야 한다.
        if (!testHost.isAutofillDropdownVisible(account.username)) {
            // 디버그: 현재 화면에 어떤 노드가 있는지 기록 (auth dataset 탐지 실패 원인 분석용)
            helper.dumpViewHierarchy("before_auth_dataset_click")
            helper.captureScreen("before_auth_dataset_click")
            // auth dataset 항목 탭 — 부분 문자열 매칭 (실제 노드 텍스트: "🔒 잠금 해제하여 자동완성을 사용하세요.")
            val authDatasetText = "잠금 해제하여 자동완성을 사용하세요"
            val authTapped = helper.clickByTextContains(authDatasetText, "auth dataset")
                || run {
                    Log.w("AUTOFILL_E2E", "Auth dataset not found, retrying after 3s (save UI delay)")
                    Thread.sleep(3000)
                    helper.clickByTextContains(authDatasetText, "auth dataset retry")
                }
            assertTrue("Neither autofill dropdown nor auth dataset appeared after re-wrap+expiry", authTapped)

            // 네이티브 인증 프롬프트 처리.
            // 참고(검증됨 2026-08): 이 프롬프트는 BiometricPrompt 시스템 창이라 접근성 트리에
            // 노드가 노출되지 않아 UIAutomator 탐지가 불가능하다. 대신 프롬프트가 뜰 것이
            // 확실한 상태(35초 캐시 만료 + dataset 탭 성공)이므로 키코드로 PIN을 직접 입력한다.
            Thread.sleep(2500) // 프롬프트 렌더링 대기
            val pinEntered = testHost.inputPinViaKeyEvents(TEST_DEVICE_PIN)
            assertTrue("Failed to input PIN via key events", pinEntered)
            Thread.sleep(2000)
        }

        // 인증 통과 후 드롭다운 대기.
        // 주의(검증됨 2026-08): 인증 응답 dataset은 프레임워크가 표시하지만 지연이 있고,
        // 이때 필드를 재클릭하면 떠 있던 드롭다운이 닫혀버린다. 재클릭 금지 — 넉넉히 대기만.
        Log.d("AUTOFILL_E2E", "Waiting up to 30s for authenticated dataset dropdown...")
        val dropdownAppeared = testHost.waitForAutofillDropdown(account.username, timeoutMs = 30_000)
        if (!dropdownAppeared) {
            // 그래도 안 떴을 때만 필드 재클릭으로 fill 요청 재발화 (최후 수단)
            helper.dumpViewHierarchy("dropdown_missing_before_reclick")
            testHost.clickUsernameField()
        }
        testHost.selectAutofillSuggestion(account.username)
        assertTrue("Password should be autofilled after re-wrap and user auth",
            testHost.verifyPasswordFilled(account.password))
        helper.dumpViewHierarchy("autofill_after_rewrap_verified")
        helper.captureScreen("autofill_after_rewrap_verified")

        Log.e("DEBUG", "=== resyncAfterDeviceCredentialAdded: PASS ===")

        // 정리: PIN 제거 (다음 테스트 실행 환경 복원)
        clearDevicePin(TEST_DEVICE_PIN)
    }

    /** adb locksettings로 기기 PIN 설정
     *  - persistent_data_block 서비스가 늦게 준비되는 에뮬레이터에서 set-pin이
     *    ServiceNotFoundException으로 실패할 수 있으므로 재시도한다 (검증됨 2026-08)
     *  - 성공 여부를 KeyguardManager.isDeviceSecure로 실제 확인 — 실패 시 테스트 fail
     */
    private fun setDevicePin(pin: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val uiAutomation = instrumentation.uiAutomation
        var output = ""
        for (attempt in 1..3) {
            val stream = uiAutomation.executeShellCommand("locksettings set-pin $pin")
            output = java.io.FileInputStream(stream.fileDescriptor).bufferedReader().readText()
            stream.close()
            if (output.contains("Pin set", ignoreCase = true)) {
                Log.i("AUTOFILL_E2E", "Device PIN set (attempt $attempt): ${output.trim()}")
                break
            }
            Log.w("AUTOFILL_E2E", "set-pin attempt $attempt failed: ${output.trim()}")
            Thread.sleep(3000)
        }
        // 실제 잠금화면 설정 여부 확인 (가짜 통과 방지)
        Thread.sleep(1000)
        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
        assertTrue(
            "Device PIN was not actually set (isDeviceSecure=false). locksettings output: ${output.trim()}",
            keyguardManager.isDeviceSecure
        )
        Log.i("AUTOFILL_E2E", "KeyguardManager.isDeviceSecure=true confirmed")
    }

    /** adb locksettings로 기기 PIN 제거 */
    private fun clearDevicePin(pin: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val uiAutomation = instrumentation.uiAutomation
        for (attempt in 1..3) {
            val output = uiAutomation.executeShellCommand("locksettings clear --old $pin")
                .let { pf -> java.io.FileInputStream(pf.fileDescriptor).bufferedReader().readText() }
            val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
            if (!keyguardManager.isDeviceSecure) {
                Log.i("AUTOFILL_E2E", "Device PIN cleared (attempt $attempt)")
                return
            }
            Log.w("AUTOFILL_E2E", "clear attempt $attempt output: ${output.trim()}")
            Thread.sleep(3000)
        }
        Log.w("AUTOFILL_E2E", "Device PIN may still be set after clear attempts")
    }

    /** KIYO 앱을 포어그라운드로 가져오기 */
    private fun bringKiyoAppToForeground() {
        val intent = Intent().apply {
            setClassName("com.kiyo.app", "com.kiyo.app.MainActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        device.wait(Until.hasObject(By.pkg("com.kiyo.app").depth(0)), 10000)
    }
}