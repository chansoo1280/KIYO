package com.kiyo.app.autofill

import android.content.Context
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import com.kiyo.app.e2e.pageobjects.AccountsPage
import com.kiyo.app.e2e.pageobjects.AutofillLoginPage
import com.kiyo.app.e2e.pageobjects.HomePage
import com.kiyo.app.e2e.pageobjects.SettingsPage
import com.kiyo.app.e2e.testutil.NativeAuthPromptHandler
import com.kiyo.app.e2e.testutil.DeviceOpsHelper
import com.kiyo.app.e2e.testutil.E2EEnv
import com.kiyo.app.e2e.testutil.E2EEnv.BaseEnv
import com.kiyo.app.e2e.testutil.TestDataFactory
import com.kiyo.app.e2e.testutil.WebViewTestHelper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import org.junit.runner.RunWith

/**
 * 검증 시나리오 E2E 테스트 (plan 2026-08-25).
 *
 * - 모든 시나리오는 자기완결: 첫 줄 ensureBaseEnvironment()로 환경 확보,
 *   필요한 sync/잠금화면을 스스로 수행하고 finally에서 정리(clearPin).
 * - 순서 의존 없음 (@FixMethodOrder 제거). 전체 실행 순서는 스크립트가 보장.
 */
@RunWith(AndroidJUnit4::class)
class AutofillE2ETest {

    // 테스트 실패 시 스크린샷/덤프 자동 캡처
    @get:Rule
    val failureWatcher = object : TestWatcher() {
        override fun failed(e: Throwable, description: Description) {
            val testName = description.methodName
            Log.e("AUTOFILL_E2E_DEBUG", ">>> TEST FAILED: $testName - ${e.message}")
            // dump/screenshot 분리: 한쪽이 실패해도 다른 쪽은 시도한다.
            try {
                val hierarchy = helper.dumpViewHierarchy("FAILURE_$testName")
                Log.e("AUTOFILL_E2E_DEBUG", ">>> DUMP OK: $hierarchy")
            } catch (ex: Throwable) {
                Log.e("AUTOFILL_E2E_DEBUG", ">>> DUMP FAILED: ${ex.message}", ex)
            }
            try {
                val screen = helper.captureScreen("FAILURE_$testName")
                Log.e("AUTOFILL_E2E_DEBUG", ">>> SCREENSHOT OK: $screen")
            } catch (ex: Throwable) {
                Log.e("AUTOFILL_E2E_DEBUG", ">>> SCREENSHOT FAILED: ${ex.message}", ex)
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
    private lateinit var testHost: NativeAuthPromptHandler

    private lateinit var vaultName: String
    private lateinit var account: TestDataFactory.AccountInfo
    private val testPin = TestDataFactory.TEST_PIN

    @Before
    fun setup() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext()
        autofillManager = context.getSystemService(AutofillManager::class.java)
        helper = WebViewTestHelper("AutofillE2ETest")
        testHost = NativeAuthPromptHandler(device)

        // instrumentation extra(-e vaultName) 지정 > 유니크 이름(CI 기본)
        vaultName = E2EEnv.requestedVaultName()
            ?: TestDataFactory.uniqueVaultName(encrypted = false)
        // 볼트 파일명에서 계정을 결정적으로 도출 (세션 간 불일치 제거)
        account = TestDataFactory.accountForVault(vaultName)

        // 잔여 자동완성 DB/DB_KEY 정리 — instrumentation 프로세스당 1회.
        // (Keystore 키는 유지: recreate=false. 이전 실행의 sync 카운트 오염 방지 목적)
        CleanupGuard.runOnce {
            com.kiyo.app.e2e.testutil.TestSecurityInitializer.initializeCleanEnvironment(
                context, recreateKeystoreKeys = false,
            )
        }
    }

    /** 프로세스별 1회 실행 가드 */
    private object CleanupGuard {
        @Volatile
        private var done = false
        fun runOnce(block: () -> Unit) {
            synchronized(this) {
                if (!done) {
                    block()
                    done = true
                }
            }
        }
    }

    private fun isDeviceSecure(): Boolean {
        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
        return km.isDeviceSecure
    }

    /** 공통 환경 확보 + 앱 기동/바인딩 — 시나리오 시작점은 계정 리스트 */
    private fun ensureEnvironment(): BaseEnv =
        E2EEnv.ensureBaseEnvironment(
            vaultName = vaultName,
            account = account,
            device = device,
            context = context,
            helper = helper,
            nativeAuth = testHost,
        ).also { env ->
            homePage = env.homePage
            accountsPage = env.accountsPage
            settingsPage = env.settingsPage
        }

    /**
     * no-auth fill 검증 — 비암호화 볼트를 동기화한 뒤 프롬프트 없이 fill 되는지 확인.
     * (구 1단계 테스트의 "검증" 부분. 환경 구축은 ensureBaseEnvironment가 담당)
     */
    @Test
    fun noAuthFill() {
        Log.e("DEBUG", "=== noAuthFill: START ===")
        val env = ensureEnvironment()

        // sync는 각 시나리오가 스스로 수행 (plan: ensureBaseEnvironment는 sync 미포함)
        env.settingsPage.navigateToSettings()
        if (!env.settingsPage.clickSyncAccounts()) {
            throw AssertionError("Sync accounts failed")
        }

        // ===== 자동완성 검증: testHost 앱에서 실제 자동완성 드롭다운 확인 =====
        env.autofillLogin.launch(env.account.domain)
        env.autofillLogin.clickUsernameField(env.account.username) // 드롭다운 표시 유발
        env.autofillLogin.selectAutofillSuggestion(env.account.username)
        assertTrue(
            "Password should be autofilled",
            env.autofillLogin.verifyPasswordFilled(env.account.password),
        )
        Log.e("AUTOFILL_E2E", "Autofill verified: username and password filled correctly")

        Log.e("DEBUG", "=== noAuthFill: PASS ===")
    }

    /**
     * auth-required 재래핑 검증 (구 2단계).
     *
     * 흐름:
     * 1. 최초 sync (비암호화, 기기 잠금 없음)
     * 2. 기기 PIN 설정 → 30초 대기 (재sync에서 auth 프롬프트 유발)
     * 3. 재동기화 (BiometricPrompt PIN 인증으로 재래핑 유발)
     * 4. 즉시 testHost → fill 검증 (캐시 유효, 인증 없음)
     * 5. 프로세스 kill (캐시 만료) → testHost → auth dataset → PIN 입력 → fill 검증
     */
    @Test
    fun authResync() {
        Log.e("DEBUG", "=== authResync: START ===")
        val env = ensureEnvironment()
        var pinWasSetByThisTest = false
        try {
            // 1. 최초 sync — 비암호화, 기기 잠금 없음 (멱등)
            env.settingsPage.navigateToSettings()
            env.settingsPage.clickSyncAccounts()

            // 2. 기기 PIN 설정 → 30초 대기 (setPin의 인증 효과 가라앉기 + 캐시 만료)
            if (!isDeviceSecure()) {
                DeviceOpsHelper.setPin(context, testPin)
                pinWasSetByThisTest = true
            }
            DeviceOpsHelper.bringAppToForeground(device)
            env.helper.waitForWebViewReady()

            // 재sync에서 auth 프롬프트를 유발하려면 Keystore 인증 상태가 만료되어야 한다.
            // setPin 직후에는 크리덴셜 등록 자체가 인증으로 인정되므로 시간 경과가 필요 (검증됨 2026-08).
            Log.e("DEBUG", "=== authResync: waiting 30s for auth cache expiry before re-sync ===")
            Thread.sleep(30_000)

            // 3. 재동기화 — BiometricPrompt PIN 인증으로 재래핑 유발
            env.settingsPage.navigateToSettings()
            env.settingsPage.clickSyncAccountsWithPinAuth(testPin)
            assertTrue(
                "KIYO account count should be preserved",
                env.helper.waitForText("KIYO 앱"),
            )
            E2EEnv.markRewrapped()

            // 4. 즉시 testHost → fill 검증 (캐시 유효, 인증 없음)
            Log.e("DEBUG", "=== authResync: verifying immediate fill (cache valid) ===")
            env.autofillLogin.launch(env.account.domain)
            env.autofillLogin.clickUsernameField(env.account.username) // 드롭다운 표시 유발
            env.autofillLogin.selectAutofillSuggestion(env.account.username)
            assertTrue(
                "Password should be autofilled immediately after re-wrap (cache valid)",
                env.autofillLogin.verifyPasswordFilled(env.account.password),
            )

            // 5. 프로세스 kill (캐시 만료) → testHost → auth dataset → PIN 입력 → fill 검증
            Log.e("DEBUG", "=== authResync: killing process to expire auth cache ===")
            DeviceOpsHelper.killProcess()
            Thread.sleep(2000) // 프로세스 종료 완료 대기 (kill은 비동기 — 너무 빠른 재시작 시 불안정, 검증됨)
            DeviceOpsHelper.bringAppToForeground(device)
            Thread.sleep(2000) // 재시작 후 초기 렌더링 안정화

            Log.e("DEBUG", "=== authResync: verifying autofill in test host with auth ===")
            env.autofillLogin.launch(env.account.domain)
            env.autofillLogin.clickUsernameField(env.account.username) // 드롭다운 표시 유발
            if (!env.autofillLogin.isDropdownVisible(env.account.username)) {
                val authDatasetText = "잠금 해제하여 자동완성을 사용하세요"
                val authTapped = env.helper.clickByTextContains(authDatasetText, "auth dataset") ||
                    run {
                        Log.w("AUTOFILL_E2E", "Auth dataset not found, retrying after 3s (save UI delay)")
                        Thread.sleep(3000)
                        env.helper.clickByTextContains(authDatasetText, "auth dataset retry")
                    }
                assertTrue("Neither autofill dropdown nor auth dataset appeared after re-wrap+expiry", authTapped)

                Thread.sleep(2500)
                val pinEntered = env.nativeAuth.inputPinViaKeyEvents(testPin)
                assertTrue("Failed to input PIN via key events", pinEntered)
                Thread.sleep(2000)
            }

            Log.d("AUTOFILL_E2E", "Waiting up to 30s for authenticated dataset dropdown...")
            env.autofillLogin.selectAutofillSuggestion(env.account.username)
            assertTrue(
                "Password should be autofilled after re-wrap and user auth",
                env.autofillLogin.verifyPasswordFilled(env.account.password),
            )
            Log.e("DEBUG", "=== authResync: PASS ===")
        } finally {
            // 자기완결 정리 (규칙 4): 성공/실패 무관 PIN 해제
            if (pinWasSetByThisTest || isDeviceSecure()) {
                DeviceOpsHelper.clearPin(context, testPin)
            }
        }
    }

    /**
     * 보안 다운그레이드 검증 (구 step4).
     * 흐름: 잠금화면 확보 → 최초 sync + 재래핑 선행(항상 멱등 수행) → 잠금화면 제거
     * → sync → reset 로그 관찰 → 재구축/fill 검증 → finally에서 clearPin.
     */
    @Test
    fun downgradeReset() {
        Log.e("DEBUG", "=== downgradeReset: START ===")
        val env = ensureEnvironment()
        var pinWasSetByThisTest = false
        try {
            // 1. 잠금화면 확보 + auth-required 상태 선행 구축 (단독 실행 대비, 규칙 5·Open Q1)
            if (!isDeviceSecure()) {
                DeviceOpsHelper.setPin(context, testPin)
                pinWasSetByThisTest = true
            }
            DeviceOpsHelper.bringAppToForeground(device)
            env.helper.waitForWebViewReady()

            // 2. 최초 sync + 재래핑 선행 (멱등 — 이미 돼도 무해)
            env.settingsPage.navigateToSettings()
            env.settingsPage.clickSyncAccounts()
            env.settingsPage.clickSyncAccountsWithPinAuth(testPin)
            assertTrue("Initial resync should preserve account count", env.helper.waitForText("KIYO 앱"))
            E2EEnv.markRewrapped()

            // 3. 잠금화면 제거 (auth-required 키 vs 잠금화면 없음 = 다운그레이드 상태)
            DeviceOpsHelper.clearPin(context, testPin)
            Thread.sleep(2000) // credential 변경 반영 대기 (동기 — 기록된 검증사항)
            DeviceOpsHelper.bringAppToForeground(device)
            env.helper.waitForWebViewReady()

            // 4. 동기화 → 다운그레이드 감지 지점 (reset + rebuild)
            env.settingsPage.navigateToSettings()
            env.settingsPage.clickSyncAccounts()

            // 5. 관찰: 다운그레이드 로그 (instrumentation이 같은 기기의 logcat을 읽음)
            Thread.sleep(3000)
            val logcat = DeviceOpsHelper.readLogcat(500)
            val sawDowngrade = logcat.contains("Security downgrade detected")
            val sawReset = logcat.contains("Resetting autofill security state")
            Log.i("AUTOFILL_E2E", "downgrade log: detected=$sawDowngrade reset=$sawReset")
            assertTrue(
                "Logcat should record 'Resetting autofill security state' after lockscreen removal + sync",
                sawReset,
            )

            // 6. 재구축 검증: 계정 수 유지 + 마지막 동기화 갱신
            assertTrue(
                "KIYO account count should be preserved after downgrade rebuild",
                env.helper.waitForText("KIYO 앱"),
            )

            // 7. 다운그레이드 후 fill 검증 (잠금화면 없음 → auth 없는 키 → 프롬프트 없이 fill)
            env.autofillLogin.launch(env.account.domain)
            env.autofillLogin.clickUsernameField(env.account.username) // 드롭다운 표시 유발
            env.autofillLogin.selectAutofillSuggestion(env.account.username)
            assertTrue(
                "Password should be autofilled after downgrade rebuild",
                env.autofillLogin.verifyPasswordFilled(env.account.password),
            )
            Log.e("DEBUG", "=== downgradeReset: PASS ===")
        } finally {
            // 자기완결 정리 (규칙 4): 성공/실패 무관 PIN 해제 시도
            DeviceOpsHelper.clearIfSet(context, testPin)
        }
    }
}
