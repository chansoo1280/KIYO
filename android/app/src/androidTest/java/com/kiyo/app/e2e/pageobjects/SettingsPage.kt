package com.kiyo.app.e2e.pageobjects

import android.content.Intent
import android.util.Log
import androidx.test.espresso.web.sugar.Web.onWebView
import androidx.test.espresso.web.webdriver.DriverAtoms.findElement
import androidx.test.espresso.web.webdriver.Locator
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.e2e.testutil.DeviceOpsHelper
import com.kiyo.app.e2e.testutil.NativeAuthPrompt
import com.kiyo.app.e2e.testutil.WebViewTestHelper

class SettingsPage(helper: WebViewTestHelper, private val nativeAuthPrompt: NativeAuthPrompt) : BasePage(helper) {

    override val markers = listOf("자동완성")

    /**
     * Settings 탭 → 파일변경 "이동" 버튼 → 파일 선택 화면 진입.
     * Settings 화면 UI 운전이므로 본 페이지가 담당 (구 AppScreenState.navigateToFileSelectionViaSettings — 2026-08-28 이관).
     * 활성 볼트가 열려 있을 때(계정 리스트 등) 파일 선택 화면으로 가는 정상 UI 경로.
     * Auth 화면(잠김)에서는 Settings 탭이 없어 실패(false 반환) — 호출자가 폴백 처리.
     */
    fun navigateToFileSelection(): Boolean = try {
        helper.log("Trying file-change navigation: Settings tab > '이동' button")
        // Settings 화면 진입 (이미 My accounts 등 로그인 상태여야 탭이 존재)
        if (!helper.clickByAriaLabel("Settings", "settings tab")) {
            helper.log("Settings tab not found (locked auth screen?)")
            false
        } else if (!helper.waitForText("파일변경", 10000)) {
            helper.log("'파일변경' row not found on Settings")
            false
        } else if (!helper.clickByText("이동", "file change button")) {
            helper.log("'이동' button not found")
            false
        } else {
            val loaded = helper.waitForText(AuthPage.FILE_SELECT_MARKER, 10000) ||
                helper.waitForText(AuthPage.CREATE_FILE_MARKER, 10000)
            if (loaded) {
                helper.log("Reached file selection screen via Settings > '이동'")
            } else {
                helper.log("File selection screen did not load from file change")
            }
            loaded
        }
    } catch (e: Exception) {
        helper.log("navigateToFileSelection failed: ${e.message}")
        false
    }

    /** 설정 화면으로 네비게이션 (하단 탭에서 설정 탭 클릭) */
    fun navigateToSettings(): SettingsPage {
        log("Navigating to Settings tab")
        // 하단 탭 (소스 검증됨: BottomTabs.tsx의 aria-label="Settings")
        val clicked = helper.clickByAriaLabel("Settings", "settings tab")
        if (!clicked) throw AssertionError("Could not find Settings tab")
        helper.waitForText("자동완성") // 자동완성 섹션 헤더 대기
        log("Settings page loaded, autofill section visible")
        return this
    }

    // ============ 생체인증 섹션 (SecuritySection.tsx) ============

    /**
     * 생체인증 활성화 (UI 경유 + logcat 마커 프로토콜).
     * 전제: 로그인된 상태에서 navigateToSettings() 완료.
     * 프롬프트는 접근성 트리에 노출되지 않으므로(보안 정책) 고정 딜레이 후 onPromptVisible
     * 콜백 호출 — 호출자가 logcat 마커 출력 등 호스트 협력 동작을 수행.
     * 성공 메시지("생체인증이 활성화되었습니다")까지 대기해 반환.
     */
    fun enableBiometric(scenario: String, onPromptVisible: () -> Unit) {
        log("Enabling biometric (Settings > Security)")

        // SecuritySection의 생체인증 토글 버튼 ("사용 안 함" = 비활성 상태)
        if (!helper.waitForText("사용 안 함", 8000)) {
            // 이미 활성("사용 중")이라도 stale 키 위험(Keystore 등록 무효화)이 있으므로
            // 비활성화 후 재활성화한다 — 재등록 강제 (2026-08-28).
            if (helper.waitForText("사용 중", 2000)) {
                log("Biometric already enabled ('사용 중' button) — disabling for re-enrollment")
                assertTrue(helper.clickByText("사용 중", "biometric disable button"))
                if (!helper.waitForTextContains("저장된 키가 삭제되었습니다", 10000)) {
                    throw AssertionError("Existing biometric key delete failed during re-enrollment")
                }
                if (!helper.waitForText("사용 안 함", 8000)) {
                    throw AssertionError("'사용 안 함' button not shown after biometric disable")
                }
                log("Stale key deleted, proceeding to re-enable")
            } else {
                throw AssertionError("Biometric toggle button not found on Settings > Security")
            }
        }
        var dialogShown = false
        for (attempt in 1..3) {
            assertTrue(helper.clickByText("사용 안 함", "biometric enable button"))
            if (helper.waitForText("생체인증 등록", 8000)) {
                dialogShown = true
                break
            }
            log("Setup dialog not shown (attempt $attempt) — retrying enable click")
        }
        if (!dialogShown) {
            helper.dumpViewHierarchy("biometric_setup_dialog_missing")
            helper.captureScreen("biometric_setup_dialog_missing")
            throw AssertionError("Biometric setup dialog did not appear")
        }
        assertTrue(helper.clickByText("등록하기", "biometric setup confirm button"))

        // BiometricPrompt 네이티브 창 렌더링 대기 후 콜백 (호스트가 finger touch 주입)
        log("Waiting for native BiometricPrompt to render...")
        Thread.sleep(4000)
        onPromptVisible()

        // 성공 메시지 확인 (호스트 주입 → onAuthenticationSucceeded → storeKey 성공)
        if (!helper.waitForTextContains("생체인증이 활성화되었습니다", 30000)) {
            throw AssertionError("Biometric enable success message not shown (fingerprint injection failed?)")
        }
        log("Biometric enabled successfully")
    }

    /**
     * 생체인증 비활성화 + biometric 키 삭제 (deleteKey — Capacitor bridge 경유).
     * 앱이 백그라운드여도 포그라운드로 복구해 처리. finally 정리용으로 예외를 던지지 않는다.
     * @return 정상 처리 완료 여부 (이미 비활성 상태면 true)
     */
    fun disableBiometricBestEffort(device: UiDevice): Boolean {
        return try {
            DeviceOpsHelper.bringAppToForeground(device)
            if (!helper.waitForWebViewReady()) return false
            if (!helper.clickByAriaLabel("Settings", "settings tab")) return false
            helper.waitForText("자동완성")
            if (!helper.waitForText("생체인증 로그인", 5000)) return false
            if (!helper.clickByText("사용 중", "biometric disable button")) {
                log("Biometric already disabled (no '사용 중' button)")
                return true
            }
            val deleted = helper.waitForTextContains("저장된 키가 삭제되었습니다", 10000)
            log("disableBiometric completed (deleted message=$deleted)")
            deleted
        } catch (e: Exception) {
            log("disableBiometric cleanup failed (best effort): ${e.message}")
            false
        }
    }

    private fun assertTrue(condition: Boolean) {
        if (!condition) throw AssertionError("SettingsPage assertion failed")
    }

    /** 자동완성 섹션의 "동기화" 버튼 클릭
     *  - 최초 실행 시 네이티브 인증 프롬프트 발생 (Keystore 30분 캐시 만료 시)
     *  - 인증 완료 후 동기화 진행
     */
    fun clickSyncAccounts(): Boolean {
            log("Clicking sync accounts button")
            // "동기화" 버튼 (비활성화 상태일 수 있음 - syncing 중이면)
            val clicked = helper.clickByText("동기화", "sync accounts button") ||
                    helper.clickByText("동기화 중...", "sync accounts button (loading)") ||
                    helper.clickByText("Sync", "sync accounts button (EN)")
            if (!clicked) {
                log("Could not find sync accounts button")
                return false
            }

            // 동기화 완료 대기 (네이티브 인증 프롬프트 처리 포함 최대 60초)
            if (!waitForSyncCompleteWithNativeAuth()) {
                log("Sync accounts failed")
                return false
            }
            log("Sync accounts completed")
            return true
        }

    /** 동기화 완료 대기 (네이티브 인증 프롬프트 처리 포함) */
    fun waitForSyncCompleteWithNativeAuth(timeoutMs: Long = 60000): Boolean {
        log("Waiting for sync to complete (with native auth handling)...")
        val startTime = System.currentTimeMillis()

        while (System.currentTimeMillis() - startTime < timeoutMs) {
            // 1. 성공 판정: 화면에 "동기화 완료" 메시지 표시 (AutofillSection showMessage)
            //    - "자동완성 계정 N개 동기화 완료" / "동기화 완료 (N개 오류)" 모두 커버
            if (helper.waitForTextContains("동기화 완료", 500)) {
                log("Sync completed - success message displayed")
                return true
            }

            // 2. 실패 판정: 에러 메시지 표시
            if (helper.waitForText("동기화 실패", 500) || helper.waitForText("인증이 취소", 500)) {
                log("Sync failed or auth cancelled")
                return false
            }

            // 3. 네이티브 인증 프롬프트 감지 및 처리
            if (nativeAuthPrompt.waitForNativeAuthPrompt(2000)) {
                log("Native auth prompt detected - waiting for user auth")
                Thread.sleep(2000)
                continue
            }

            // 4. 동기화 중 상태면 계속 대기
            if (helper.waitForText("동기화 중", 500)) {
                Thread.sleep(1000)
                continue
            }

        }

        log("Timeout waiting for sync completion")
        return false
    }

    /** "마지막 동기화" 시간 텍스트 읽기 */
    private fun getLastSyncTimeText(): String? {
        // AutofillSection에서 "마지막 동기화" 라벨과 시간은 부모 div 안의 형제 span.
        // wrapper 구조 비의존으로 부모 div 내부의 마지막 span을 매칭.
        return helper.getTextByXPath("//*[contains(., '마지막 동기화')]/span[last()]")
            ?: helper.getTextByXPath("//div[.//span[contains(text(), '마지막 동기화')]]/span[last()]")
            ?: helper.getTextByXPath("(//span[contains(@class, 'text-xs')])[last()]")
    }

    /** 마지막 동기화 시간이 변경될 때까지 대기 */

    /** "자동완성 사용" 토글(role="switch") 클릭하여 ON
     *  - 설정 화면에 role="switch"가 2개 있음 (다크모드 + 자동완성)
     *  - 다크모드 토글 오클릭 방지를 위해 자동완성 전용 aria-label로 타겟팅
     *  - 성공 판정: 토글 ON 후 "자동완성 서비스" 섹션이 렌더링됨 (autofillEnabled && 조건)
     */
    fun enableAutofillToggle(): SettingsPage {
        log("Enabling autofill toggle")
        if (isAutofillToggleChecked()) {
            log("Autofill toggle already ON")
            return this
        }
        val clicked = helper.clickByAriaLabel("자동완성 사용 꺼짐", "autofill toggle (off state)")
        if (!clicked) throw AssertionError(
            "Could not find autofill toggle with aria-label '자동완성 사용 꺼짐' " +
                "(다크모드 토글을 잘못 클릭하지 않았는지 확인 필요)"
        )
        // 토글 ON → "자동완성 서비스" 섹션 렌더링 대기 (성공 판정)
        if (!helper.waitForText("자동완성 서비스")) {
            throw AssertionError("Autofill service section did not appear after toggle ON")
        }
        log("Autofill toggle enabled, service section visible")
        return this
    }

    /** "활성화" 버튼 클릭 → 시스템 자동완성 선택 다이얼로그에서 KIYO 선택
     *  - requestAutofillEnable()이 시스템 다이얼로그(ACTION_REQUEST_SET_AUTOFILL_SERVICE)를 띄움
     *  - 다이얼로그는 WebView 밖이므로 UIAutomator로 처리
     */
    fun activateAutofillService(): SettingsPage {
        log("Activating autofill service")
        val clicked = helper.clickByText("활성화", "enable autofill button") ||
            helper.clickByText("Enable", "enable autofill button (EN)")
        if (!clicked) {
            // 이미 KIYO 서비스가 활성화된 경우 "설정" 버튼만 존재
            if (helper.waitForText("설정", 2000)) {
                log("Autofill service already enabled (settings button visible)")
                return this
            }
            throw AssertionError("Could not find enable autofill button")
        }

        // 시스템 다이얼로그에서 KIYO 선택 (WebView 밖 → UIAutomator)
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val dialogAppeared = device.wait(Until.hasObject(By.textContains("KIYO")), 10000) != null
        Log.i("AUTOFILL_E2E", "Autofill service picker dialog appeared: $dialogAppeared")
        helper.captureScreen("autofill_service_picker")
        helper.dumpViewHierarchy("autofill_service_picker")

        // 다이얼로그 목록에서 KIYO 항목 클릭
        val kiyoItem = device.findObject(By.textContains("KIYO"))
            ?: device.wait(Until.findObject(By.textContains("KIYO")), 5000)
        if (kiyoItem != null) {
            kiyoItem.click()
            Log.i("AUTOFILL_E2E", "Selected KIYO in autofill service picker")
        } else {
            throw AssertionError("KIYO not found in autofill service picker dialog")
        }

        // KIYO 선택 후 확인 대화상자 처리 ("Change your preferred service to KIYO...")
        // - 최신 Android: 목록 선택 즉시 적용, 확인 다이얼로그 없음 → 짧게 대기 후 넘어감
        // - 구버전: Cancel(android:id/button2) / Change(android:id/button1) 다이얼로그
        val confirmButton = device.wait(
            Until.findObject(By.res("android", "button1")),
            2000,
        )
        if (confirmButton != null) {
            Log.i("AUTOFILL_E2E", "Confirmation dialog detected - clicking Change")
            helper.captureScreen("autofill_confirm_dialog")
            confirmButton.click()
            // Change 클릭 후 CredentialsPickerActivity가 포그라운드에 남아 있으면
            // MainActivity가 resume되지 않아 "KIYO 자동완성 활성화됨" 텍스트가 렌더링되지 않는다
            // (검증됨 2026-08-25). back 대신 앱을 명시적으로 포그라운드로 복귀시킨다 —
            // back press는 Capacitor backButton 핸들러로 들어가 WebView 히스토리가
            // Settings→Accounts로 이동해버림 (검증됨 2026-08-25 2차).
            val device2 = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            if (device2.hasObject(By.pkg("com.android.settings").depth(0))) {
                Log.i("AUTOFILL_E2E", "Picker still in foreground after Change - relaunching KIYO app")
                val appContext = InstrumentationRegistry.getInstrumentation()
                    .targetContext.applicationContext
                // CLEAR_TASK로 재시작해야 WebView가 리로드되며 isAutofillEnabled를 재조회해
                // UI가 "활성화됨"으로 갱신된다. restart만으로는 React 상태가 stale (검증됨 2026-08-25 3차)
                appContext.startActivity(
                    Intent().apply {
                        setClassName("com.kiyo.app", "com.kiyo.app.MainActivity")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                        data = android.net.Uri.parse("kiyo://settings")
                    },
                )
                helper.waitForWebViewReady()
                // 재시작 후 Settings 탭으로 이동 (CLEAR_TASK면 홈에서 시작함)
                WebViewTestHelper.clickAriaLabelStatic(device2, "Settings", "settings tab after relaunch")
            }
        } else {
            Log.i("AUTOFILL_E2E", "No confirmation dialog (applied directly)")
        }

        // 상태가 "KIYO 자동완성 활성화됨"으로 갱신될 때까지 대기
        if (!helper.waitForText("KIYO 자동완성 활성화됨", 10000)) {
            throw AssertionError("Autofill service status did not update to enabled")
        }
        log("Autofill service activated")
        return this
    }

    /** 동기화 버튼 클릭 + Keystore 인증 프롬프트에서 PIN 입력까지 처리
     *  - 기기 자격증명 추가로 인해 auth-required 키가 된 후 첫 동기화에서 사용
     */
    fun clickSyncAccountsWithPinAuth(devicePin: String): SettingsPage {
        log("Clicking sync accounts button (with PIN auth expected)")
        val clicked = helper.clickByText("동기화", "sync accounts button") ||
            helper.clickByText("동기화 중...", "sync accounts button (loading)")
        if (!clicked) throw AssertionError("Could not find sync accounts button")

        // BiometricPrompt는 접근성 트리에 노출되지 않아(보안 정책) waitForNativeAuthPrompt로
        // 감지 불가 (검증됨 2026-08). 화면 상태와 무관하게 키코드 PIN을 전송하는 방식 사용.
        // 프롬프트 렌더링 대기 후 키코드 입력.
        Thread.sleep(3000)
        val entered = nativeAuthPrompt.inputPinViaKeyEvents(devicePin)
        if (!entered) {
            throw AssertionError("Failed to input PIN via key events")
        }
        log("PIN sent via key events, waiting for auth + sync completion")

        val startTime = System.currentTimeMillis()
        val timeoutMs = 30000L
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            // 재입력 필요(프롬프트가 아직 떠 있고 인증 안 됨)하면 한 번 더 시도
            if (!nativeAuthPrompt.waitForNativeAuthPrompt(2000)) {
                // 성공 판정: AuthActivity 종료로 WebView 루트 복귀 + 마지막 동기화 시각 존재
                if (!AuthPage.isCurrentVia(helper)) {
                    log("Auth prompt dismissed - sync auth completed")
                    return this
                }
            } else {
                log("Auth prompt still visible, retrying PIN via key events")
                nativeAuthPrompt.inputPinViaKeyEvents(devicePin)
            }
            Thread.sleep(500)
        }

        throw AssertionError("Timeout waiting for sync completion with PIN auth")
    }

    // ============ 자동 저장(DataSection) ============

    companion object {
        /** 자동 저장 OFF 상태 텍스트 (DataSection.tsx getAutoBackupStatus) */
        const val AUTO_BACKUP_OFF_TEXT = "자동 백업: 꺼짐"
        /** 자동 저장 ON 상태 텍스트 prefix (뒤에 URI 표시) */
        const val AUTO_BACKUP_ON_TEXT = "자동 백업: 켜짐"
        /** 자동 저장 토글 OFF 버튼 라벨 */
        const val AUTO_BACKUP_TOGGLE_OFF = "해제"
        /** 자동 저장 토글 ON 버튼 라벨 (최초 + 위치 미설정 상태 모두 동일) */
        const val AUTO_BACKUP_TOGGLE_ON = "켜기"
        /** 폴더 선택 확인 다이얼로그 헤더 */
        const val AUTO_BACKUP_DIALOG_TITLE = "자동 백업 폴더 선택"
        const val AUTO_BACKUP_DIALOG_CONFIRM = "폴더 선택"
        const val AUTO_BACKUP_DIALOG_CANCEL = "취소"
        /** 자동 백업 ON 직후 표시되는 success 메시지 (위치 설정 + 첫 백업 완료) */
        const val AUTO_BACKUP_SUCCESS = "자동 백업 위치가 설정되고 첫 백업이 완료되었습니다."
        const val AUTO_BACKUP_SUCCESS_URI_ONLY = "자동 백업 위치가 설정되었습니다."
    }

    /**
     * 자동 저장(자동 백업) 토글을 ON으로 설정.
     *
     * 플로우:
     *   Settings > Data > "켜기" → 폴더 선택 확인 다이얼로그 → "폴더 선택" → SAF picker →
     *   instrumentation 내부에서 UiDevice로 사이드 메뉴 → Documents → "Use this folder" 확정.
     *
     * onFolderPickerReady: 더 이상 사용하지 않음 (이전 호스트 ps1 watcher 의존 — 제거됨).
     * 2026-08-29 host-side ps1 watcher가 instrumentation의 UiAutomationService 등록과
     * 충돌하는 것으로 보임. instrument 내부에서 UiDevice로 picker 운전을 흡수해서 host는
     * `am instrument`만 실행하면 되도록 단순화.
     */
    fun enableAutoBackup(device: UiDevice, onFolderPickerReady: () -> Unit = {}): SettingsPage {
        log("Enabling auto-backup (Settings > Data > 자동 백업)")

        // 1. 현재 상태 확인 — 이미 켜져 있으면 OFF 시킨 뒤 새로 켠다.
        //    이전 테스트가 finally에서 disable에 실패했거나 스크립트가 재실행되어
        //    stale URI가 남아있을 수 있어, 새 폴더 picker를 강제 트리거한다.
        //    (BiometricUnlockE2ETest.enableBiometric의 stale 키 재등록 패턴과 동일)
        if (helper.isTextPresent(AUTO_BACKUP_ON_TEXT)) {
            log("Auto-backup already ON — disabling first to allow fresh folder selection")
            if (!disableAutoBackupBestEffort()) {
                helper.dumpViewHierarchy("autosave_disable_for_reenable_failed")
                helper.captureScreen("autosave_disable_for_reenable_failed")
                throw AssertionError("Could not disable auto-backup before re-enable")
            }
            // 해제 후 상태 텍스트(자동 백업: 꺼짐) + UI 안정화 대기
            if (!helper.waitForText(AUTO_BACKUP_OFF_TEXT, 5000)) {
                throw AssertionError(
                    "Auto-backup did not reach OFF state before re-enable. " +
                        "Expected '$AUTO_BACKUP_OFF_TEXT'.",
                )
            }
            Thread.sleep(1000)
            log("Auto-backup reset to OFF, proceeding to re-enable")
        }

        // 2. "켜기" 버튼 클릭. 토글 disabled 조건(native 미지원/평문 볼트)은 사전에 E2EEnv에서
        //    encrypted=true로 통과시켰으므로 활성화 상태여야 한다.
        if (!helper.clickByText(AUTO_BACKUP_TOGGLE_ON, "auto-backup toggle ON button")) {
            throw AssertionError("Auto-backup toggle button ('${AUTO_BACKUP_TOGGLE_ON}') not clickable")
        }

        // 3. 폴더 선택 확인 다이얼로그가 떠야 한다 ("자동 백업 폴더 선택")
        if (!helper.waitForText(AUTO_BACKUP_DIALOG_TITLE, 5000)) {
            throw AssertionError("Auto-backup folder picker confirm dialog did not appear")
        }
        log("Auto-backup folder picker dialog visible")

        // 4. "폴더 선택" 클릭 → SAF OpenDocumentTree activity 실행
        if (!helper.clickByText(AUTO_BACKUP_DIALOG_CONFIRM, "auto-backup folder select confirm")) {
            throw AssertionError("Could not click '폴더 선택' on auto-backup dialog")
        }

        // 5. SAF picker 렌더링 대기 + instrumentation 내부에서 picker 운전
        //    (호스트 ps1 watcher 제거됨 — 2026-08-29 UiAutomationService 충돌 회피)
        log("Waiting for native SAF folder picker to render...")
        if (!driveSafPicker(device)) {
            helper.dumpViewHierarchy("autosave_saf_picker_drive_failed")
            helper.captureScreen("autosave_saf_picker_drive_failed")
            throw AssertionError("SAF folder picker driving failed (Use this folder not tapped)")
        }

        // 6. 성공 판정 — 토글 ON 메시지(첫 백업 포함 또는 위치만) 중 하나가 떠야 한다.
        //    - encrypted=true + cryptoKey + salt 모두 있는 상태에서 활성화되므로
        //      persistVaultSnapshot이 즉시 실행되어 "첫 백업이 완료되었습니다"까지 가는 게 정상.
        val startTime = System.currentTimeMillis()
        val timeoutMs = 30000L
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            if (helper.isTextPresent(AUTO_BACKUP_SUCCESS) ||
                helper.isTextPresent(AUTO_BACKUP_SUCCESS_URI_ONLY)
            ) {
                log("Auto-backup success message displayed")
                break
            }
            if (helper.isTextPresent(AUTO_BACKUP_ON_TEXT)) {
                // success 메시지가 사라졌더라도 상태 텍스트가 ON이면 성공으로 간주
                log("Auto-backup state text already ON")
                break
            }
            Thread.sleep(500)
        }
        if (!helper.isTextPresent(AUTO_BACKUP_ON_TEXT)) {
            helper.dumpViewHierarchy("autosave_enable_no_on_state")
            helper.captureScreen("autosave_enable_no_on_state")
            throw AssertionError(
                "Auto-backup did not turn ON. Expected '$AUTO_BACKUP_ON_TEXT (...)' state text after SAF picker confirm."
            )
        }
        log("Auto-backup enabled (state=$AUTO_BACKUP_ON_TEXT)")
        return this
    }

    /**
     * SAF OpenDocumentTree picker를 instrumentation 내부에서 자동 운전.
     *
     * 플로우:
     *   1) picker 렌더링 대기 (USE THIS FOLDER / Show roots 마커)
     *   2) 사이드 메뉴(content-desc="Show roots"/"루트 보기") 탭 → 루트 목록 오픈
     *   3) "Documents" / "내 문서" 탭
     *   4) "USE THIS FOLDER" / "이 폴더 사용" / android:id/button1 탭 → picker 닫힘
     *
     * UiAutomator2는 native process의 노드도 볼 수 있어 SAF picker 안의 버튼 클릭 가능.
     * host ps1의 Start-Job watcher 없이 동작 — UiAutomationService 충돌 회피.
     *
     * @return picker 운전 성공 여부
     */
    private fun driveSafPicker(device: UiDevice): Boolean {
        // 1) picker 렌더링 대기
        var pickerReady = false
        for (i in 0 until 30) {
            if (device.hasObject(By.text("USE THIS FOLDER")) ||
                device.hasObject(By.text("Use this folder")) ||
                device.hasObject(By.text("이 폴더 사용")) ||
                device.hasObject(By.desc("Show roots")) ||
                device.hasObject(By.desc("루트 보기"))
            ) {
                pickerReady = true
                log("SAF picker detected (attempt $i)")
                break
            }
            Thread.sleep(500)
        }
        if (!pickerReady) {
            log("SAF picker did not appear within timeout")
            return false
        }

        // 2) 사이드 메뉴 열기 (content-desc 기반, 좌표 폴백 포함)
        var hamburgerOk = false
        val descCandidates = listOf("Show roots", "루트 보기", "Open navigation drawer", "내비게이션 서랍 열기", "Roots")
        for (d in descCandidates) {
            val obj = device.findObject(By.desc(d))
            if (obj != null) {
                obj.click()
                hamburgerOk = true
                log("Side menu opened via desc='$d'")
                break
            }
        }
        if (!hamburgerOk) {
            // 좌표 폴백: 좌측 상단 햄버거 영역
            log("Side menu not found by desc, trying coordinate (60, 200)")
            device.click(60, 200)
        }
        Thread.sleep(1500)
        val deviceModels = listOf(
            "sdk_gphone16k_x86_64"
        )
        for (t in deviceModels) {
            val obj = device.findObject(By.text(t))
            if (obj != null) {
                obj.click()
                log("Tapped '$t' (primary storage / Documents root)")
                break
            }
        }
        Thread.sleep(1500)

        // 3) Primary storage 진입 — 스톡 DocumentsUI는 `sdk_gphone16k_x86_64` 같은
        //    primary storage 별칭이 사이드 메뉴의 첫 항목이며, 탭하면 primary 내부로
        //    들어가서 "USE THIS FOLDER"가 활성화된다. "Documents"는 primary의 하위
        //    폴더라 그 자체로 picker 루트가 아님. 양쪽 후보를 모두 시도한다.
        val primaryCandidates = listOf(
            "Documents", "내 문서", "Documents storage", "Primary storage", "주 저장소", "Internal storage"
        )
        for (t in primaryCandidates) {
            val obj = device.findObject(By.text(t))
            if (obj != null) {
                obj.click()
                log("Tapped '$t' (primary storage / Documents root)")
                break
            }
        }
        Thread.sleep(1500)

        // 4) "Use this folder" 확정 + 권한 다이얼로그 흡수 (한 루프에서 둘 다 처리)
        //    SAF OpenDocumentTree는 폴더 선택 확정 시 "Allow kiyo to access folder?" OS 다이얼로그를
        //    띄운다 — 이게 떠 있으면 USE THIS FOLDER가 가려져 매칭이 안 됨.
        //    권한 다이얼로그가 뜨면 ALLOW를 처리하고, picker가 닫혔으면 return true.
        //
        //    매칭 전략: 1차 UiDevice.findObject(By.text) → 2차 좌표 기반 탭 (안정적 폴백).
        //    자식 AlertDialog는 별도 window라 findObject가 못 잡는 경우가 있어 좌표 폴백이 핵심.
        val useThisFolderCenterX = 540
        val useThisFolderCenterY = 2298
        val allowCenterX = 879
        val allowCenterY = 1388

        for (i in 0 until 60) {
            // 0) 권한 다이얼로그 처리 (최우선) — 텍스트 매칭 + 좌표 폴백

            // 1차: text 매칭
            for (t in listOf("USE THIS FOLDER", "Use this folder", "이 폴더 사용", "이 폴더선택", "USE")) {
                val obj = device.findObject(By.text(t))
                if (obj != null) {
                    obj.click()
                    log("Tapped '$t' (Use this folder) by text")
                    Thread.sleep(1000)
                    // UiDevice 자식 다이얼로그 못 잡는 케이스 — 좌표 폴백
                    device.click(allowCenterX, allowCenterY)
                    log("Tapped ALLOW (access permission dialog) by coordinate ($allowCenterX, $allowCenterY)")
                    return true
                }
            }
            Thread.sleep(500)
        }
        log("'Use this folder' button not found within timeout")
        return false
    }

    /**
     * 자동 저장 토글 OFF (DataSection "해제" 버튼).
     * URI도 함께 비워지므로(React setAutoBackupUri(null) + setAutoBackupEnabled(false)),
     * 다음 테스트가 새 폴더로 다시 설정할 수 있는 깨끗한 상태가 된다.
     * best-effort: 실패해도 예외를 던지지 않고 false 반환 (cleanup 용도).
     */
    fun disableAutoBackupBestEffort(): Boolean {
        return try {
            // Settings에 머무는 상태가 전제. 호출자가 네비게이션을 보장.
            if (!helper.isTextPresent(AUTO_BACKUP_TOGGLE_OFF)) {
                log("Auto-backup already OFF (no '해제' button) — skip disable")
                return true
            }
            if (!helper.clickByText(AUTO_BACKUP_TOGGLE_OFF, "auto-backup disable button")) {
                log("Could not click '해제' button (maybe toggling)")
                return false
            }
            // 상태 OFF 전환 대기 (메시지 텍스트가 켜져있던 토글이 없어지면 성공)
            val startTime = System.currentTimeMillis()
            while (System.currentTimeMillis() - startTime < 10000) {
                if (helper.isTextPresent(AUTO_BACKUP_OFF_TEXT)) {
                    log("Auto-backup disabled (state=$AUTO_BACKUP_OFF_TEXT)")
                    return true
                }
                // 메시지(첫 백업 완료) 등이 잠시 남아있을 수 있으니 '해제' 버튼이 사라졌는지도 보조 판정
                if (!helper.isTextPresent(AUTO_BACKUP_TOGGLE_OFF)) {
                    log("Auto-backup disable button gone — assuming OFF")
                    return true
                }
                Thread.sleep(300)
            }
            log("Auto-backup did not turn OFF within timeout")
            false
        } catch (e: Exception) {
            log("disableAutoBackupBestEffort failed: ${e.message}")
            false
        }
    }

    /** 자동완성 토글의 aria-checked 상태 확인 (aria-label로 정확히 타겟팅) */
    private fun isAutofillToggleChecked(): Boolean {
        return try {
            // aria-label='자동완성 사용 켜짐' 토글이 존재하면 ON 상태 (요소 탐색 실패 시 예외)
            onWebView()
                .withElement(findElement(
                    Locator.XPATH,
                    "//button[@role='switch' and @aria-checked='true' and @aria-label='자동완성 사용 켜짐']",
                ))
            true
        } catch (e: Exception) {
            false
        }
    }
}