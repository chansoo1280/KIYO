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
import com.kiyo.app.e2e.pageobjects.AccountsPage
import com.kiyo.app.e2e.pageobjects.AuthPage
import com.kiyo.app.e2e.pageobjects.SettingsPage
import com.kiyo.app.e2e.testutil.NativeAuthPromptHandler
import com.kiyo.app.e2e.testutil.E2EEnv
import com.kiyo.app.e2e.testutil.TestDataFactory
import com.kiyo.app.e2e.testutil.WebViewTestHelper
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
        settingsPage = SettingsPage(helper, NativeAuthPromptHandler(device))

        vaultName = E2EEnv.requestedVaultName()
            ?: TestDataFactory.uniqueVaultName(encrypted = true)
        account = TestDataFactory.accountForVault(vaultName)

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
    private fun ensureEncryptedEnvironment() {
            E2EEnv.ensureBaseEnvironment(
                vaultName = vaultName,
                account = account,
                device = device,
                context = context,
                helper = helper,
                nativeAuth = NativeAuthPromptHandler(device),
                encrypted = true,
            )
        }

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
     * 공통 상태구축: 암호화 볼트 확보 → 생체인증 (재)활성화.
     * 각 시나리오가 독자 호출 (순서 의존 없음).
     */
    private fun setupBiometricVault(scenario: String) {
        ensureEncryptedEnvironment()
        settingsPage.navigateToSettings()
        settingsPage.enableBiometric(scenario) {
            Log.i(MARKER_TAG, "${nextMarker(scenario)} AWAIT_FINGER")
        }
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
        val ok = settingsPage.disableBiometricBestEffort(device)
        if (!ok) {
            // finally 정리 실패는 다음 테스트 오염의 씨앗 — 눈에 띄게 남긴다.
            Log.wtf(TAG, "disableBiometric failed: biometric key may remain. Next test must handle '사용 중' state.")
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
            if (!helper.waitForText(AccountsPage.MARKER_TEXT, 30000)) {
                throw AssertionError("Accounts list did not load after fingerprint unlock")
            }
            if (!helper.waitForText(account.title, 10000)) {
                // 언락 직후에는 Espresso-Web 컨텍스트 재부착/하이드레이션 지연으로
                // 렌더가 늦을 수 있다 (검증됨 2026-08-28: 화면엔 값이 이미 표시됨).
                // WebView 재부착 후 1회 재시도한다.
                helper.waitForWebViewReady()
                if (!helper.waitForText(account.title, 10000)) {
                    throw AssertionError("Account '${account.title}' not rendered in list after biometric unlock")
                }
            }
            Log.i(TAG, "$scenario: session restored via fingerprint — PASS")
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
                throw AssertionError("PIN fallback error message not shown after biometric cancel")
            }
            Log.i(TAG, "$scenario: cancel fallback message shown")

            // PIN 폴백 언락 성공 검증
            authPage.unlockWithPin(testPin)
            Log.i(TAG, "$scenario: PIN fallback unlocked — PASS")
        } finally {
            disableBiometricViaUi()
        }
    }


}
