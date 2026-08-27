package com.kiyo.app.biometric

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.autofill.pageobjects.AuthPage
import com.kiyo.app.autofill.pageobjects.SettingsPage
import com.kiyo.app.autofill.testutil.AutofillTestHost
import com.kiyo.app.autofill.testutil.E2EEnv
import com.kiyo.app.autofill.testutil.E2EEnv.BaseEnv
import com.kiyo.app.autofill.testutil.TestDataFactory
import com.kiyo.app.autofill.testutil.WebViewTestHelper
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import org.junit.runner.RunWith

/**
 * 생체인증 볼트 잠금 해제 E2E (plan 2026-08-26-biometric-unlock-verification).
 *
 * ⚠️ 실행 방식: 반드시 android/run-biometric-e2e.ps1로 실행할 것.
 *   이 테스트들은 기기 PIN 설정 + 등록된 지문을 스크립트 setup 전제로 한다.
 *   스크립트 없이 gradle connectedAndroidTest 단독 실행은 requireScriptEnvironment
 *   가드(@Before)에서 즉시 실패한다 (기기 자격증명/지문은 스크립트 생애주기로 관리).
 *
 * 지문 주입 프로토콜 (호스트-기기 협력):
 *   `emu finger touch`는 호스트 adb 전용 명령이므로 기기 내에서 실행 불가.
 *   테스트가 프롬프트 표시 후 logcat에 "BIOMETRIC_E2E <marker> AWAIT_FINGER"를
 *   출력하면, 호스트 ps1이 이를 폴링 감지해 `adb -e emu finger touch 1`을 주입하고,
 *   테스트는 결과 메시지(성공/실패 UI 텍스트) 렌더링으로 완료를 판단한다.
 *   취소 시나리오는 "BIOMETRIC_E2E <marker> CANCEL_FINGER" 마커에 호스트가
 *   KEYCODE_BACK을 전송한다.
 *
 * 자기완결 원칙:
 *   - 각 시나리오는 ensureEncryptedEnvironment()로 암호화 볼트를 스스로 확보하고
 *     setupBiometricVault() 공통 헬퍼를 독자 호출 — 순서 의존 없음.
 *   - KIYO 앱 상태(biometric 키)는 finally에서 disableBiometric으로 정리.
 *     기기 PIN/clearPin은 하지 않는다(스크립트 종료 시 1회 — plan 규정).
 *
 * 화면 UI 운전은 각 페이지 객체(AuthPage/SettingsPage)가 담당하고,
 * 이 클래스는 시나리오 오케스트레이션 + 마커 프로토콜만 수행한다.
 */
@RunWith(AndroidJUnit4::class)
class BiometricUnlockE2ETest {

    companion object {
        private const val TAG = "BiometricE2E"
        private const val MARKER_TAG = "BIOMETRIC_E2E"
    }

    // 테스트 실패 시 스크린샷/계층 덤프 자동 캡처
    @get:Rule
    val failureWatcher = object : TestWatcher() {
        override fun failed(e: Throwable, description: Description) {
            val testName = description.methodName
            Log.e(TAG, ">>> TEST FAILED: $testName - ${e.message}", e)
            try {
                helper.dumpViewHierarchy("FAILURE_$testName")
                helper.captureScreen("FAILURE_$testName")
            } catch (ex: Exception) {
                Log.w(TAG, "Failed to capture failure state: ${ex.message}")
            }
        }
    }

    private lateinit var device: UiDevice
    private lateinit var context: Context
    private lateinit var helper: WebViewTestHelper
    private lateinit var authPage: AuthPage
    private lateinit var settingsPage: SettingsPage

    private lateinit var vaultName: String
    private lateinit var account: TestDataFactory.AccountInfo
    private val testPin = TestDataFactory.TEST_PIN
    private var markerSeq = 0

    /** 스크립트 전제 가드: 기기 자격증명(PIN)이 있어야 생체인증 등록/인증이 가능하다 */
    @Before
    fun requireScriptEnvironment() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext()
        helper = WebViewTestHelper(TAG)
        authPage = AuthPage(helper)
        settingsPage = SettingsPage(helper, AutofillTestHost(device))

        vaultName = E2EEnv.requestedVaultName()
            ?: TestDataFactory.uniqueVaultName(encrypted = true)
        account = E2EEnv.accountForVault(vaultName)

        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        assertTrue(
            "이 테스트는 run-biometric-e2e.ps1(또는 동등한 setup: setPin+지문등록)을 " +
                "통해 실행되어야 합니다 (isDeviceSecure=false)",
            km.isDeviceSecure,
        )
        Log.i(TAG, "Script environment guard passed (isDeviceSecure=true), vault=$vaultName")
    }

    // ============ 공통 헬퍼 (각 테스트가 독자 호출 — 순서 의존 없음) ============

    /**
     * 암호화 볼트 확보 (각 시나리오 시작점).
     * E2EEnv.ensureBaseEnvironment(encrypted=true)는 매번 고유 이름으로 신규 암호화
     * 볼트를 생성/활성화하므로 stale 상태(잔여 plain 볼트 등)에 독립적이다.
     */
    private fun ensureEncryptedEnvironment(): BaseEnv =
        E2EEnv.ensureBaseEnvironment(
            vaultName = vaultName,
            account = account,
            device = device,
            context = context,
            helper = helper,
            testHost = AutofillTestHost(device),
            encrypted = true,
        )

    /**
     * 앱 재시작(CLEAR_TASK) → Auth 화면 진입.
     * cryptoKey는 메모리 전용이므로 재시작 후 반드시 잠김 상태로 Auth에 도달한다.
     * (비암호화 볼트면 Auth를 거치지 않고 홈으로 가므로, Auth 도달 자체가
     *  활성 암호화 볼트 존재의 실측 증거다 — plan §1.1)
     */
    private fun restartToAuthScreen() {
        val intent = Intent().apply {
            setClassName("com.kiyo.app", "com.kiyo.app.MainActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            data = Uri.parse("kiyo://files")
        }
        context.startActivity(intent)
        device.wait(Until.hasObject(By.pkg("com.kiyo.app").depth(0)), 15000)
        Thread.sleep(3000)
        authPage.waitForScreen()
    }

    /** 고유 logcat 마커 생성 */
    private fun nextMarker(prefix: String): String = "$prefix-${++markerSeq}"

    /**
     * 공통 상태구축: 암호화 볼트 확보 → PIN 1회 언락 → 생체인증 활성화.
     * 각 시나리오가 독자 호출 (순서 의존 없음).
     */
    private fun setupBiometricVault(scenario: String): BaseEnv {
        val env = ensureEncryptedEnvironment()
        settingsPage.navigateToSettings()
        settingsPage.enableBiometric(scenario) {
            Log.i(MARKER_TAG, "${nextMarker(scenario)} AWAIT_FINGER")
        }
        return env
    }

    /**
     * 잠금(Auth) 화면으로 진입 후 지문 로그인 버튼 클릭 + 마커 출력.
     * 호출 시점: 생체인증 활성화 직후 (로그인 세션 유지) 또는 재시작 직후.
     * mode=RESTART이면 CLEAR_TASK 재시작, SESSION_LOCK이면 현재 프로세스 유지.
     */
    private enum class LockMode { RESTART, SESSION_LOCK }

    private fun tapBiometricLoginButton(scenario: String, mode: LockMode) {
        when (mode) {
            LockMode.RESTART -> restartToAuthScreen()
            LockMode.SESSION_LOCK -> authPage.waitForScreen()
        }
        authPage.tapFingerprintLogin {
            Log.i(MARKER_TAG, "${nextMarker(scenario)} AWAIT_FINGER")
        }
    }

    /** 생체인증 비활성화 + biometric 키 삭제 (각 테스트 finally 정리 겸용). */
    private fun disableBiometricViaUi() {
        settingsPage.disableBiometricBestEffort(device)
    }

    // ============ 시나리오 1~4 ============

    /**
     * 시나리오 1: 암호화 볼트 준비 → 설정 > Security > 생체인증 활성화 → 프롬프트 통과.
     * 검증: 활성화 성공 메시지 + 앱 재시작 후 Auth 화면에 지문 버튼 노출.
     */
    @Test
    fun storeKey_enrollsBiometricProtection() {
        val scenario = "storeKey"
        val env = setupBiometricVault(scenario)
        try {
            // 활성화 성공 메시지는 setupBiometricVault 내부에서 검증 완료.
            // 추가 검증: 앱 재시작 후 Auth 화면에 지문 버튼 노출 (hasKey==true 실측)
            restartToAuthScreen()
            if (!authPage.waitForFingerprintButton(10000)) {
                helper.dumpViewHierarchy("${scenario}_button_after_restart_missing")
                helper.captureScreen("${scenario}_button_after_restart_missing")
                throw AssertionError("Fingerprint login button not exposed on Auth screen after restart (hasKey should be true)")
            }
            Log.i(TAG, "$scenario: fingerprint button visible after restart — PASS")

            // 재진입 확인용 대기 (Auth 상태 유지 확인)
            assertTrue(helper.waitForText("KIYO 잠금 해제", 3000))
            env.helper.captureScreen("${scenario}_verified")
        } finally {
            disableBiometricViaUi()
        }
    }

    /**
     * 시나리오 2: 활성화 → 앱 재시작 → 지문 로그인 → /accounts 진입 + 계정 목록 렌더링.
     */
    @Test
    fun unlockWithBiometric_restoresSession() {
        val scenario = "unlockBio"
        setupBiometricVault(scenario)
        try {
            restartToAuthScreen()

            // 지문 버튼 탭 → 프롬프트 통과 (마커 출력은 tapBiometricLoginButton 내부)
            tapBiometricLoginButton(scenario, LockMode.SESSION_LOCK)

            // 언락 성공 판정: /accounts 화면 + 계정 목록 렌더링 (세션/cryptoKey 복원 증명)
            if (!helper.waitForText("My accounts", 30000)) {
                helper.dumpViewHierarchy("${scenario}_unlock_failed")
                helper.captureScreen("${scenario}_unlock_failed")
                throw AssertionError("Accounts list did not load after fingerprint unlock")
            }
            if (!helper.waitForText(account.title, 10000)) {
                helper.dumpViewHierarchy("${scenario}_account_not_rendered")
                helper.captureScreen("${scenario}_account_not_rendered")
                throw AssertionError("Account '${account.title}' not rendered in list after biometric unlock")
            }
            Log.i(TAG, "$scenario: session restored via fingerprint — PASS")
            helper.captureScreen("${scenario}_verified")
        } finally {
            disableBiometricViaUi()
        }
    }

    /**
     * 시나리오 3: 지문 버튼 탭 → 프롬프트 취소 → 오류 메시지 + PIN 폴백 언락.
     */
    @Test
    fun cancelBiometric_fallsBackToPin() {
        val scenario = "cancelBio"
        setupBiometricVault(scenario)
        try {
            restartToAuthScreen()

            authPage.tapFingerprintLogin {
                // CANCEL 마커 → 호스트가 KEYCODE_BACK 전송해 프롬프트 취소
                Log.i(MARKER_TAG, "${nextMarker(scenario)} CANCEL_FINGER")
            }

            // 취소 → onError → React setError("...PIN으로 로그인해 주세요.")
            if (!helper.waitForTextContains("PIN으로 로그인", 30000)) {
                helper.dumpViewHierarchy("${scenario}_cancel_message_missing")
                helper.captureScreen("${scenario}_cancel_message_missing")
                throw AssertionError("PIN fallback error message not shown after biometric cancel")
            }
            Log.i(TAG, "$scenario: cancel fallback message shown")

            // PIN 폴백 언락 성공 검증
            authPage.unlockWithPin(testPin)
            Log.i(TAG, "$scenario: PIN fallback unlocked — PASS")
            helper.captureScreen("${scenario}_verified")
        } finally {
            disableBiometricViaUi()
        }
    }

    /**
     * 시나리오 4: 생체인증 비활성화(deleteKey) → Auth 화면에서 지문 버튼 미노출.
     */
    @Test
    fun deleteKey_disablesBiometricButton() {
        val scenario = "deleteKey"
        val env = setupBiometricVault(scenario)
        try {
            // 먼저 활성화 상태에서 버튼이 실제로 노출되는지 확인 (검증 기준선)
            restartToAuthScreen()
            assertTrue(
                "Fingerprint button should be visible while key exists (baseline)",
                authPage.waitForFingerprintButton(10000),
            )
            Log.i(TAG, "$scenario: baseline confirmed (button visible with key)")

            // 잠금 상태에서는 Settings 접근 불가 → PIN으로 언락한 뒤 비활성화
            authPage.unlockWithPin(testPin)
            disableBiometricViaUi()

            // 다시 잠금 → 지문 버튼 사라짐(hasKey==false), PIN만 표시
            restartToAuthScreen()
            if (authPage.waitForFingerprintButton(5000)) {
                helper.dumpViewHierarchy("${scenario}_button_still_visible")
                helper.captureScreen("${scenario}_button_still_visible")
                throw AssertionError("Fingerprint button still visible after key deletion")
            }
            assertTrue(helper.waitForText("KIYO 잠금 해제", 5000))
            Log.i(TAG, "$scenario: button gone after key deletion — PASS")
            env.helper.captureScreen("${scenario}_verified")
        } finally {
            disableBiometricViaUi()
        }
    }
}
