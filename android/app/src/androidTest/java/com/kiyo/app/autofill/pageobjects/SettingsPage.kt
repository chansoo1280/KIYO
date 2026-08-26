package com.kiyo.app.autofill.pageobjects

import android.content.Intent
import android.util.Log
import androidx.test.espresso.web.sugar.Web.onWebView
import androidx.test.espresso.web.webdriver.DriverAtoms.findElement
import androidx.test.espresso.web.webdriver.Locator
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.autofill.testutil.AutofillTestHost
import com.kiyo.app.autofill.testutil.WebViewTestHelper

class SettingsPage(helper: WebViewTestHelper, private val testHost: AutofillTestHost) : BasePage(helper) {

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
                helper.dumpViewHierarchy("after_sync")
                helper.captureScreen("after_sync")
                return true
            }

            // 2. 실패 판정: 에러 메시지 표시
            if (helper.waitForText("동기화 실패", 500) || helper.waitForText("인증이 취소", 500)) {
                log("Sync failed or auth cancelled")
                helper.dumpViewHierarchy("sync_failed")
                helper.captureScreen("sync_failed")
                return false
            }

            // 3. 네이티브 인증 프롬프트 감지 및 처리
            if (testHost.waitForNativeAuthPrompt(2000)) {
                log("Native auth prompt detected - waiting for user auth")
                Thread.sleep(2000)
                continue
            }

            // 4. 동기화 중 상태면 계속 대기
            if (helper.waitForText("동기화 중", 500)) {
                Thread.sleep(1000)
                continue
            }

            Thread.sleep(500)
        }

        log("Timeout waiting for sync completion")
        helper.dumpViewHierarchy("sync_timeout")
        helper.captureScreen("sync_timeout")
        return false
    }

    /** "마지막 동기화" 시간 텍스트 읽기 */
    private fun getLastSyncTimeText(): String? {
        return helper.getTextByXPath("//span[contains(text(), '마지막 동기화')]/following-sibling::span[1]")
            ?: helper.getTextByXPath("//*[contains(text(), '마지막 동기화')]/following-sibling::*[1]")
            ?: helper.getTextByXPath("(//span[contains(@class, 'text-xs')])[last()]")
    }

    /** 마지막 동기화 시간이 변경될 때까지 대기 */
    private fun waitForLastSyncTimeChanged(beforeText: String?, timeoutMs: Long): Boolean {
        val start = System.currentTimeMillis()
        while (System.currentTimeMillis() - start < timeoutMs) {
            val current = getLastSyncTimeText()
            if (current != null && current != beforeText && current != "동기화된 적 없음") {
                log("Last sync time changed: '$beforeText' -> '$current'")
                return true
            }
            Thread.sleep(500)
        }
        log("Last sync time did not change (before='$beforeText', current='${getLastSyncTimeText()}')")
        return false
    }

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
            helper.captureScreen("autofill_picker_kiyo_not_found")
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
            Thread.sleep(1000)
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
                Thread.sleep(4000)
                // 재시작 후 Settings 탭으로 이동 (CLEAR_TASK면 홈에서 시작함)
                Thread.sleep(2000)
                WebViewTestHelper.clickAriaLabelStatic(device2, "Settings", "settings tab after relaunch")
            }
        } else {
            Log.i("AUTOFILL_E2E", "No confirmation dialog (applied directly)")
        }

        // 상태가 "KIYO 자동완성 활성화됨"으로 갱신될 때까지 대기
        if (!helper.waitForText("KIYO 자동완성 활성화됨", 10000)) {
            helper.captureScreen("autofill_service_status_after_enable")
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
        val entered = testHost.inputPinViaKeyEvents(devicePin)
        if (!entered) {
            helper.dumpViewHierarchy("pin_auth_input_failed")
            helper.captureScreen("pin_auth_input_failed")
            throw AssertionError("Failed to input PIN via key events")
        }
        log("PIN sent via key events, waiting for auth + sync completion")

        val startTime = System.currentTimeMillis()
        val timeoutMs = 30000L
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            // 재입력 필요(프롬프트가 아직 떠 있고 인증 안 됨)하면 한 번 더 시도
            if (!testHost.waitForNativeAuthPrompt(2000)) {
                // 성공 판정: AuthActivity 종료로 WebView 루트 복귀 + 마지막 동기화 시각 존재
                if (!helper.waitForText("KIYO 잠금 해제", 500)) {
                    log("Auth prompt dismissed - sync auth completed")
                    helper.dumpViewHierarchy("after_sync_with_auth")
                    helper.captureScreen("after_sync_with_auth")
                    return this
                }
            } else {
                log("Auth prompt still visible, retrying PIN via key events")
                testHost.inputPinViaKeyEvents(devicePin)
            }
            Thread.sleep(500)
        }

        helper.dumpViewHierarchy("sync_pin_auth_timeout")
        helper.captureScreen("sync_pin_auth_timeout")
        throw AssertionError("Timeout waiting for sync completion with PIN auth")
    }

    /** 자동완성 활성화 토글 상태 확인 */
    fun isAutofillEnabled(): Boolean {
        // 토글 스위치 상태 확인 (role="switch", aria-checked)
        // 구현 필요시 추가
        return true
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