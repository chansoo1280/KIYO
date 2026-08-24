package com.kiyo.app.autofill.pageobjects

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
    fun clickSyncAccounts(): SettingsPage {
        log("Clicking sync accounts button")
        // "동기화" 버튼 (비활성화 상태일 수 있음 - syncing 중이면)
        val clicked = helper.clickByText("동기화", "sync accounts button") ||
            helper.clickByText("동기화 중...", "sync accounts button (loading)") ||
            helper.clickByText("Sync", "sync accounts button (EN)")
        if (!clicked) throw AssertionError("Could not find sync accounts button")

        // 동기화 완료 대기 (네이티브 인증 프롬프트 처리 포함 최대 60초)
        waitForSyncCompleteWithNativeAuth()
        log("Sync accounts completed")
        return this
    }

    /** 동기화 완료 대기 (네이티브 인증 프롬프트 처리 포함) */
    fun waitForSyncCompleteWithNativeAuth(timeoutMs: Long = 60000): Boolean {
        log("Waiting for sync to complete (with native auth handling)...")
        val startTime = System.currentTimeMillis()

        while (System.currentTimeMillis() - startTime < timeoutMs) {
            // 1. 동기화 성공 판정: "마지막 동기화" 시간이 갱신됨 ("동기화된 적 없음" 사라짐)
            //    (showMessage()는 상태에만 저장되고 화면 텍스트가 바뀌지 않으므로
            //     "동기화 완료"/"자동완성 계정 N개" 같은 텍스트는 화면에 나타나지 않음 - 폴링 제거)
            if (!helper.waitForText("동기화된 적 없음", 300)) {
                log("Sync completed - last sync time updated (no 'never synced' text)")
                helper.dumpViewHierarchy("after_sync")
                helper.captureScreen("after_sync")
                return true
            }

            // 2. 네이티브 인증 프롬프트 감지 및 처리
            if (testHost.waitForNativeAuthPrompt(2000)) {
                log("Native auth prompt detected - waiting for user auth")
                Thread.sleep(2000)
                continue
            }

            // 3. 기타 에러 확인
            if (helper.waitForText("동기화 실패", 500) || helper.waitForText("인증이 취소", 500)) {
                log("Sync failed or auth cancelled")
                helper.dumpViewHierarchy("sync_failed")
                helper.captureScreen("sync_failed")
                return false
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

        // 네이티브 인증 프롬프트(Keystore/BiometricPrompt PIN) 대기 및 입력
        val startTime = System.currentTimeMillis()
        val timeoutMs = 30000L
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            if (testHost.waitForNativeAuthPrompt(2000)) {
                log("Native auth prompt detected - entering device PIN")
                val entered = testHost.inputPinInNativeAuthPrompt(devicePin)
                if (!entered) {
                    helper.dumpViewHierarchy("pin_auth_input_failed")
                    helper.captureScreen("pin_auth_input_failed")
                    throw AssertionError("Failed to input PIN in native auth prompt")
                }
                Thread.sleep(2000)
                continue  // 프롬프트가 닫혔는지/재요청되는지 계속 확인
            }

            // 성공 판정: "동기화된 적 없음" 사라짐 (마지막 동기화 갱신)
            if (!helper.waitForText("동기화된 적 없음", 500)) {
                log("Sync completed after PIN auth")
                helper.dumpViewHierarchy("after_sync_with_auth")
                helper.captureScreen("after_sync_with_auth")
                return this
            }

            // 에러 확인
            if (helper.waitForText("동기화 실패", 300) || helper.waitForText("인증이 취소", 300)) {
                helper.dumpViewHierarchy("sync_auth_failed")
                helper.captureScreen("sync_auth_failed")
                throw AssertionError("Sync failed after PIN auth")
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