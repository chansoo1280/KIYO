package com.kiyo.app.biometric

import android.content.Context
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import com.kiyo.app.autofill.pageobjects.AccountsPage
import com.kiyo.app.autofill.pageobjects.HomePage
import com.kiyo.app.autofill.pageobjects.SettingsPage
import com.kiyo.app.autofill.testutil.AppScreenState
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
 * 생체인증 E2E 사전준비(픽스처) 테스트 (plan 2026-08-26-biometric-unlock-verification).
 *
 * prepareEncryptedVault: 암호화 볼트 생성 → 계정 생성.
 * 단일 책임 — autofill toggle/서비스 활성화/sync는 포함하지 않는다.
 * 생체인증 시나리오(BiometricUnlockE2ETest)가 각자의 소관을 스스로 수행한다.
 *
 * ⚠️ 실행 방식: 반드시 android/run-biometric-e2e.ps1로 실행할 것
 *   (스크립트 setup: 기기 PIN 설정 + 지문 등록 전제).
 *   스크립트 예: -e class ...BiometricE2EPrepareTest#prepareEncryptedVault -e vaultName <이름>
 */
@RunWith(AndroidJUnit4::class)
class BiometricE2EPrepareTest {

    private lateinit var device: UiDevice
    private lateinit var context: Context
    private lateinit var helper: WebViewTestHelper
    private lateinit var testHost: AutofillTestHost

    private lateinit var vaultName: String
    private lateinit var account: TestDataFactory.AccountInfo

    @get:Rule
    val failureWatcher = object : TestWatcher() {
        override fun failed(e: Throwable, description: Description) {
            val testName = description.methodName
            Log.e(TAG, ">>> PREPARE FAILED: $testName - ${e.message}", e)
            try {
                helper.dumpViewHierarchy("FAILURE_$testName")
                helper.captureScreen("FAILURE_$testName")
            } catch (ex: Exception) {
                Log.w(TAG, "Failed to capture failure state: ${ex.message}")
            }
        }
    }

    @Before
    fun setup() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext()
        helper = WebViewTestHelper(TAG)
        testHost = AutofillTestHost(device)

        vaultName = E2EEnv.requestedVaultName()
            ?: TestDataFactory.uniqueVaultName(encrypted = true)
        account = E2EEnv.accountForVault(vaultName)
    }

    companion object {
        private const val TAG = "BiometricE2EPrepare"
    }

    /**
     * 암호화 볼트 준비 전용 진입점 (픽스처).
     *
     * 단일 책임: 파일 선택 화면에서 암호화 볼트 생성 + 계정 생성.
     * autofill toggle/서비스 활성화/sync는 포함하지 않는다 —
     * 생체인증 E2E(BiometricUnlockE2ETest) 등 암호화 볼트가 필요한 시나리오가
     * 각자의 소관(설정/동기화)을 스스로 수행한다.
     */
    @Test
    fun prepareEncryptedVault() {
        Log.e(TAG, "=== prepareEncryptedVault: START (vaultName=$vaultName) ===")

        // 기동 → 활성 상태 실측 → 파일 선택 화면까지 이동 (잔여 활성 볼트 있으면 탈출)
        E2EEnv.launchAppAndBind(
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
            target = E2EEnv.Target.FILES,
        ).let { bound ->
            val state = AppScreenState.detect(bound.helper)
            E2EEnv.navigateToFileSelectionForPrepare(bound, state)
        }

        // 파일 선택 화면에서 암호화 볼트 생성 + 계정 생성
        val homePage = HomePage(helper)
        val accounts = homePage.clickCreateVaultButton()
            .createVault(vaultName, encrypted = true)
        val accountEditPage = accounts.clickAddAccount()
            .selectDefaultTemplate()
            .fillAccount(
                com.kiyo.app.autofill.pageobjects.AccountEditPage.AccountData(
                    title = account.title,
                    websiteUrl = account.websiteUrl,
                    username = account.username,
                    password = account.password,
                    packageName = account.packageName,
                )
            )
        accountEditPage.save()

        if (!helper.waitForText("My accounts", 10000)) {
            helper.dumpViewHierarchy("enc_account_list_not_loaded")
            helper.captureScreen("enc_account_list_not_loaded")
            throw AssertionError("Account list did not load after saving account (encrypted vault)")
        }
        if (!helper.waitForText(account.title, 10000)) {
            helper.dumpViewHierarchy("enc_account_not_saved")
            helper.captureScreen("enc_account_not_saved")
            throw AssertionError("Account title '${account.title}' not found in accounts list after save")
        }

        Log.e(TAG, "=== prepareEncryptedVault: PASS ===")
    }
}
