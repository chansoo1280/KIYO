package com.kiyo.app.autofill

import android.content.Context
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import com.kiyo.app.autofill.pageobjects.AccountsPage
import com.kiyo.app.autofill.pageobjects.HomePage
import com.kiyo.app.autofill.pageobjects.SettingsPage
import com.kiyo.app.autofill.testutil.AutofillTestHost
import com.kiyo.app.autofill.testutil.E2EEnv
import com.kiyo.app.autofill.testutil.E2EEnv.BaseEnv
import com.kiyo.app.autofill.testutil.TestDataFactory
import com.kiyo.app.autofill.testutil.WebViewTestHelper
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import org.junit.runner.RunWith

/**
 * 사전준비(픽스처) E2E 테스트 (plan 2026-08-25).
 *
 * prepareVault: 볼트 생성(비암호화) → 계정 생성 → autofill toggle ON.
 * sync는 의도적으로 포함하지 않는다 — sync 시점은 각 검증 시나리오의 의미이므로
 * AutofillE2ETest의 각 테스트가 스스로 수행한다.
 *
 * 전체 실행 시 스크립트가 이 클래스를 먼저 구동하고, 이어서 AutofillE2ETest를 구동한다.
 */
@RunWith(AndroidJUnit4::class)
class AutofillE2EPrepareTest {

    @get:Rule
    val failureWatcher = object : TestWatcher() {
        override fun failed(e: Throwable, description: Description) {
            val testName = description.methodName
            Log.e("AUTOFILL_E2E_DEBUG", ">>> PREPARE FAILED: $testName - ${e.message}", e)
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

    private lateinit var vaultName: String
    private lateinit var account: TestDataFactory.AccountInfo

    @Before
    fun setup() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext()
        autofillManager = context.getSystemService(AutofillManager::class.java)
        helper = WebViewTestHelper("AutofillE2EPrepareTest")
        testHost = AutofillTestHost(device)

        vaultName = E2EEnv.requestedVaultName()
            ?: TestDataFactory.uniqueVaultName(encrypted = false)
        account = E2EEnv.accountForVault(vaultName)

        // 보안 환경 초기화 (Keystore 키 유지) + WebView 캐시 정리 — 최초 준비 시에만
        DeviceLockGuard.runOnce {
            com.kiyo.app.testutil.DeviceLockHelper.assertUnlocked()
            com.kiyo.app.testutil.TestSecurityInitializer.initializeCleanEnvironment(
                context, recreateKeystoreKeys = false,
            )
            com.kiyo.app.testutil.TestSecurityInitializer.logEnvironmentState(context)
            E2EEnv.clearWebViewCaches(context)
        }
    }

    /** 프로세스별 1회 실행 가드 */
    private object DeviceLockGuard {
        @Volatile
        private var done = false
        inline fun runOnce(block: () -> Unit) {
            synchronized(this) {
                if (!done) {
                    block()
                    done = true
                }
            }
        }
    }

    /**
     * 환경 준비 전용 진입점 (테스트라기보다 픽스처).
     * sync 미포함 — fill 검증은 AutofillE2ETest.noAuthFill 소관.
     */
    @Test
    fun prepareVault() {
        Log.e("DEBUG", "=== prepareVault: START (vaultName=$vaultName) ===")

        val env = E2EEnv.launchAppAndBind(
            BaseEnv(
                vaultName = vaultName,
                account = account,
                device = device,
                context = context,
                helper = helper,
                homePage = HomePage(helper),
                accountsPage = AccountsPage(helper),
                settingsPage = SettingsPage(helper, testHost),
                testHost = testHost,
            ),
            target = E2EEnv.Target.FILES, // 새 볼트 생성은 파일 선택 화면에서만 가능
        )

        // TODO(plan 규칙 1·3): 화면 실측으로 활성 볼트 파일명 == vaultName 확인 후 skip 분기.
        //  현재는 pageobject에 파일명 실측 API가 없어 매 실행 구축 경로로 진행한다.
        //  ce-work 후속에서 HomePage/AccountsPage에 활성 파일명 getter 추가 시 교체.

        // 볼트 생성 (비암호화) + 계정 생성
        val accounts = env.homePage.clickCreateVaultButton()
            .createVault(vaultName, encrypted = false)
        val accountEditPage = accounts.clickAddAccount()
            .selectDefaultTemplate()
            .fillAccount(
                com.kiyo.app.autofill.pageobjects.AccountEditPage.AccountData(
                    title = env.account.title,
                    websiteUrl = env.account.websiteUrl,
                    username = env.account.username,
                    password = env.account.password,
                    packageName = env.account.packageName,
                )
            )
        accountEditPage.save()
        // Verify the account is saved by checking the account list
        // Wait for the account list screen (My accounts) and then the account title
        if (!env.helper.waitForText("My accounts", 10000)) {
            env.helper.dumpViewHierarchy("account_list_not_loaded")
            env.helper.captureScreen("account_list_not_loaded")
            throw AssertionError("Account list did not load after saving account")
        }
        if (!env.helper.waitForText(env.account.title, 10000)) {
            env.helper.dumpViewHierarchy("account_not_saved")
            env.helper.captureScreen("account_not_saved")
            throw AssertionError("Account title '${env.account.title}' not found in accounts list after save")
        }

        // 자동완성 사용 토글 ON + 서비스 활성화. sync는 여기서 수행한다.
        val settings = SettingsPage(env.helper, env.testHost).navigateToSettings()
        settings.enableAutofillToggle()
        settings.activateAutofillService()
        // 준비 단계 끝에 기본 동기화 수행 (각 테스트가 멱등하게 수행할 기반 제공)
        // settings.clickSyncAccounts()

        Log.e("DEBUG", "=== prepareVault: PASS ===")
    }
}
