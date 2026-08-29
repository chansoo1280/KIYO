package com.kiyo.app.autosave

import android.content.Context
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import com.kiyo.app.e2e.pageobjects.SettingsPage
import com.kiyo.app.e2e.testutil.E2EEnv
import com.kiyo.app.e2e.testutil.NativeAuthPromptHandler
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
 * 자동 저장(자동 백업) E2E (plan 2026-08-29-vault-integrity).
 *
 * 검증 범위:
 *  1. Settings > Data > "자동 백업" 섹션의 "켜기" 토글 클릭
 *  2. 폴더 선택 확인 다이얼로그 → "폴더 선택" 클릭 → SAF OpenDocumentTree picker 표시
 *  3. 호스트 협력으로 SAF picker에서 폴더 선택 + "이 폴더 사용" 확정
 *  4. 토글 OFF → ON 전환: 상태 텍스트가 "자동 백업: 켜짐 (...)"로 변경되고
 *     success 메시지("자동 백업 위치가 설정되고 첫 백업이 완료되었습니다.") 표시
 *  5. "해제" 토글 클릭 → 상태 OFF 전환(URI도 함께 비워짐)
 *
 * ⚠️ 실행 방식: BiometricUnlockE2ETest처럼 호스트-기기 협력이 필요하므로 전용 ps1
 *   스크립트(run-autosave-e2e.ps1)를 통해 실행할 것. 스크립트 없이 단독 실행하면
 *   SAF picker 단계에서 사용자 입력을 기다리다 타임아웃된다.
 *
 *   마커 프로토콜:
 *     - "AUTOSAVE_E2E <marker> AWAIT_PICKER" → 호스트가 SAF OpenDocumentTree
 *       다이얼로그에서 폴더 선택 + "이 폴더 사용" 확정.
 *     - "AUTOSAVE_E2E <marker> AWAIT_CANCEL" → 호스트가 SAF picker에서
 *       KEYCODE_BACK으로 취소 (cancelled 시나리오용).
 *
 * 자기완결 원칙:
 *  - 각 시나리오는 ensureBaseEnvironment(encrypted=true)로 자기 자신을 위한
 *    새 암호화 볼트 + 계정 + autofill toggle + service 활성화를 자체 수행.
 *  - 테스트 간 순서 의존 없음. UI 상의 자동 저장 토글 상태는 finally에서
 *    disableAutoBackupBestEffort로 정리(다음 테스트 오염 방지).
 *  - 디바이스 PIN/지문 등 기기 자격증명은 이 테스트가 직접 다루지 않음.
 */
@RunWith(AndroidJUnit4::class)
class AutosaveE2ETest {

    companion object {
        private const val TAG = "AutosaveE2E"
        private const val MARKER_TAG = "AUTOSAVE_E2E"
    }

    // 테스트 실패 시 스크린샷/계층 덤프 자동 캡처
    @get:Rule
    val failureWatcher = object : TestWatcher() {
        override fun failed(e: Throwable, description: Description) {
            val testName = description.methodName
            Log.e(TAG, ">>> TEST FAILED: $testName - ${e.message}")
            try {
                val hierarchy = helper.dumpViewHierarchy("FAILURE_$testName")
                Log.e(TAG, ">>> DUMP OK: $hierarchy")
            } catch (ex: Throwable) {
                Log.e(TAG, ">>> DUMP FAILED: ${ex.message}", ex)
            }
            try {
                val screen = helper.captureScreen("FAILURE_$testName")
                Log.e(TAG, ">>> SCREENSHOT OK: $screen")
            } catch (ex: Throwable) {
                Log.e(TAG, ">>> SCREENSHOT FAILED: ${ex.message}", ex)
            }
        }
    }

    private lateinit var device: UiDevice
    private lateinit var context: Context
    private lateinit var helper: WebViewTestHelper
    private lateinit var settingsPage: SettingsPage

    private lateinit var vaultName: String
    private lateinit var account: TestDataFactory.AccountInfo
    private var markerSeq = 0

    @Before
    fun setup() {
        // BiometricUnlockE2ETest와 동일 패턴 — UiDevice/Context를 매 @Before에서 새로 부른다.
        // (companion lazy / @BeforeClass 모두 동일 에러를 일으켰음 2026-08-29.
        //  BiometricUnlockE2ETest는 같은 패턴이 정상 동작 — 우리도 그대로 따른다.)
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext()
        helper = WebViewTestHelper(TAG)
        val nativeAuth = NativeAuthPromptHandler(device)
        settingsPage = SettingsPage(helper, nativeAuth)

        vaultName = E2EEnv.requestedVaultName()
            ?: TestDataFactory.uniqueVaultName(encrypted = true)
        account = TestDataFactory.accountForVault(vaultName)

        Log.i(TAG, "Setup complete, vault=$vaultName")
    }

    // ============ 공통 헬퍼 (각 테스트가 독자 호출 — 순서 의존 없음) ============

    /**
     * 암호화 볼트 + 계정 + autofill toggle/service 확보.
     * E2EEnv.ensureBaseEnvironment(encrypted=true)는 매번 고유 이름으로 신규
     * 암호화 볼트를 생성·활성화하므로 stale 토글 상태에 독립적이다.
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

    /** 고유 logcat 마커 생성 */
    private fun nextMarker(prefix: String): String = "$prefix-${++markerSeq}"

    /**
     * 자동 저장 정리 (다음 테스트 오염 방지).
     * Settings 화면을 보장하기 위해 navigateToSettings()를 선행한다.
     * best-effort: 실패해도 예외를 던지지 않고 로그만 남긴다.
     */
    private fun disableAutoBackupViaUi() {
        try {
            // Settings에 머무르지 않을 수 있으므로 명시적으로 진입 시도.
            // 토글이 이미 OFF면 Settings에 들어가지 않아도 cleanup이 완료된 상태.
            if (!helper.isTextPresent(SettingsPage.AUTO_BACKUP_TOGGLE_OFF)) {
                Log.i(TAG, "Auto-backup already OFF — skip disable")
                return
            }
            settingsPage.navigateToSettings()
            val ok = settingsPage.disableAutoBackupBestEffort()
            if (!ok) {
                Log.wtf(TAG, "disableAutoBackup failed: autoBackupUri may remain. Next test must handle stale URI.")
            }
        } catch (e: Exception) {
            Log.w(TAG, "disableAutoBackup cleanup failed (best effort): ${e.message}")
        }
    }

    // ============ 시나리오 ============

    /**
     * 자동 저장 토글 ON 시나리오.
     *
     * 자기완결로 stale 토글 상태(해제 실패/스크립트 재실행)도 흡수:
     * SettingsPage.enableAutoBackup이 이미 ON이면 자동으로 OFF → ON 한다.
     *
     * 플로우: ensureBaseEnvironment(encrypted=true) → navigateToSettings() →
     * "자동 백업" 텍스트 확인 → enableAutoBackup(SAF picker 자동 운전).
     *
     * best-effort로 첫 백업 success 메시지를 한 번 더 확인하지만, 토글 ON은
     * enableAutoBackup 내부에서 hard assert — 메시지 자체는 React state batch +
     * writeBackupToUri 비동기 I/O로 표시가 지연/유실될 수 있어 강등한다.
     */
    @Test
    fun enableAutoBackup_persistsState() {
        val scenario = "enableAutoBackup"
        ensureEncryptedEnvironment()
        try {
            settingsPage.navigateToSettings()

            // DataSection "자동 백업" 섹션이 렌더링됐는지 확인
            if (!helper.waitForText("자동 백업", 5000)) {
                throw AssertionError("'자동 백업' status text not found on Settings > Data")
            }
            Log.i(TAG, "$scenario: Settings > Data rendered, '자동 백업' status visible")

            // 토글 활성화 (instrumentation 내부에서 SAF picker 자동 운전)
            settingsPage.enableAutoBackup(device)

            // best-effort: 첫 백업 success 메시지
            val sawFirstBackupMsg = helper.waitForText(
                "자동 백업 위치가 설정되고 첫 백업이 완료되었습니다.",
                8000,
            )
            val sawUriOnlyMsg = helper.waitForText(
                "자동 백업 위치가 설정되었습니다.",
                3000,
            )
            if (sawFirstBackupMsg || sawUriOnlyMsg) {
                Log.i(TAG, "$scenario: success message displayed (firstBackup=$sawFirstBackupMsg uriOnly=$sawUriOnlyMsg)")
            } else {
                Log.w(
                    TAG,
                    "$scenario: success message not displayed (firstBackup=$sawFirstBackupMsg uriOnly=$sawUriOnlyMsg). " +
                        "Toggle ON is confirmed — backup write may have completed silently or message was dismissed by subsequent UI change.",
                )
            }
            assertTrue(sawFirstBackupMsg || sawUriOnlyMsg)
            Log.i(TAG, "$scenario: enableAutoBackup success — PASS")
        } finally {
            disableAutoBackupViaUi()
        }
    }
}
