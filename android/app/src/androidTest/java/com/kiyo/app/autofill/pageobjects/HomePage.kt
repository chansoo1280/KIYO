package com.kiyo.app.autofill.pageobjects

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.autofill.testutil.AppScreenState
import com.kiyo.app.autofill.testutil.WebViewTestHelper
import java.io.File

class HomePage(helper: WebViewTestHelper) : BasePage(helper) {

    /** 현재 활성 볼트 파일명 읽기 — UIAutomator 화면 실측 (스레드 제약 없음) */
    fun getActiveVaultFileName(): String? {
        log("Getting active vault file name...")
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())

        // 0. Auth 잠금 화면: "파일 정보" 영역에 파일명 표시됨 (Auth.tsx 파일 정보 카드)
        if (helper.waitForText("KIYO 잠금 해제", 2000)) {
            log("On auth screen, reading vault file name from file info card...")
            val node = device.wait(Until.findObject(By.textContains(".json")), 5000)
            val fileName = node?.text?.trim()
            if (!fileName.isNullOrBlank()) {
                log("Active vault file name from auth screen: $fileName")
                return fileName.removeSuffix(".json")
            }
            log("Vault file name not found on auth screen")
            return null
        }

        // 1. 계정 리스트 화면(My accounts): 파일명이 ".json"으로 표시됨
        if (helper.waitForText("My accounts", 2000)) {
            log("On accounts list screen, reading vault file name via UIAutomator...")
            val node = device.wait(Until.findObject(By.textContains(".json")), 5000)
            val fileName = node?.text?.trim()
            if (!fileName.isNullOrBlank()) {
                log("Active vault file name from accounts list: $fileName")
                return fileName.removeSuffix(".json")
            }
            log("Vault file name not found on accounts list (may be encrypted vault with no name display)")
            return null
        }

        // 2. 파일 선택 화면(파일을 선택하세요): 목록의 첫 번째 파일명
        if (helper.waitForText("파일을 선택하세요", 2000) || helper.waitForText("파일 생성", 2000)) {
            log("On file selection screen, reading first vault file name via UIAutomator...")
            val node = device.wait(Until.findObject(By.textContains(".json")), 5000)
            val fileName = node?.text?.trim()
            if (!fileName.isNullOrBlank()) {
                log("Active vault file name from file selection: $fileName")
                return fileName.removeSuffix(".json")
            }
        }

        log("No active vault file name found")
        return null
    }

    /** "파일 생성" 버튼 클릭 -> 볼트 생성 다이얼로그 열기 */
    fun clickCreateVaultButton(): VaultCreateDialog {
        log("Clicking '파일 생성' button")
        val clicked = helper.clickByText("파일 생성", "create vault button") ||
            helper.clickByAriaLabel("파일 생성", "create vault button")
        if (!clicked) throw AssertionError("Could not find '파일 생성' button")
        log("'파일 생성' button clicked, returning VaultCreateDialog")
        return VaultCreateDialog(helper)
    }

    /** 홈 화면 로드 대기 */
    fun waitForLoad(): HomePage {
        helper.waitForWebViewReady()
        helper.waitForText("파일 생성") // "파일 생성" 버튼이 보이면 로드 완료
        log("HomePage loaded")
        return this
    }

    /** 홈 화면(파일 선택 화면) 대기 - "파일을 선택하세요" 텍스트 확인 */
    fun waitForHomeScreen(): HomePage {
        helper.waitForWebViewReady()
        // 파일 선택 화면 특징 텍스트 (로그/소스 검증됨: Home.tsx)
        val loaded = helper.waitForText("파일을 선택하세요", 15000)
            || helper.waitForText("파일 생성", 15000)
        if (!loaded) {
            // 계정 리스트 화면("My accounts")이라면 하단 탭으로 네비게이션
            if (helper.waitForText("My accounts", 2000)) {
                log("Account list screen detected, trying tab navigation to list tab...")

                // 하단 탭 (BottomTabs.tsx: Templates/List/Settings aria-label)
                val tabClicked = helper.clickByAriaLabel("List", "list tab")
                    ?: helper.clickByAriaLabel("Templates", "templates tab")

                if (tabClicked) {
                    log("Clicked bottom tab")
                    Thread.sleep(1500)
                    val loaded2 = helper.waitForText("파일을 선택하세요", 5000)
                        || helper.waitForText("파일 생성", 5000)
                    if (loaded2) {
                        log("Successfully navigated to home screen via tab")
                        return this
                    }
                }
            }

            val title = helper.getPageTitle()
            log("waitForHomeScreen FAILED - page title: $title")
            helper.dumpViewHierarchy("waitForHomeScreen_failed")
            helper.captureScreen("waitForHomeScreen_failed")
            throw AssertionError("Home screen did not load - no file selection screen found. Page title: $title")
        }
        log("Home screen (file selection) loaded")
        return this
    }

    /** 앱 상태 무관하게 홈 화면(파일 탭)으로 강제 이동.
     *  볼트가 이미 열려 있으면(계정 리스트 등) 파일 탭이 아니라도 정상 상태이므로 통과시킨다. */
    fun ensureHomeScreen(): HomePage {
        helper.waitForWebViewReady()
        // 파일 선택 화면의 특징적인 텍스트 대기
        val loaded = helper.waitForText("파일을 선택하세요", 10000)
                        || helper.waitForText("파일 생성", 10000)
        if (loaded) {
            log("Already on home screen (file selection)")
            return this
        }
        // 볼트가 활성화된 상태(계정 리스트)면 홈 경유 불필요 — 그대로 사용
        if (helper.waitForText("My accounts", 5000)) {
            log("Vault already active (accounts list visible) - skip navigation")
            return this
        }

        // 현재 화면 파악 후 강제 이동
        log("Not on home screen, forcing navigation...")

        // 0. 활성 볼트가 열려 있으면(Settings 접근 가능 상태) 파일변경 "이동" 버튼으로
        //    파일 선택 화면 진입 (Settings/index.tsx handleFileChange: closeDataFile → "/").
        //    활성 볼트 존재 시 앱이 cold start에서 파일 선택 화면을 건너뛰므로 이 경로가 유일한
        //    정상 진입 방법이다 (검증됨 2026-08-27: My accounts에서 Files 탭 클릭은 무시됨).
        //    Settings 화면 UI 운전이므로 AppScreenState 유틸이 담당 (HomePage 책임 밖).
        if (AppScreenState.navigateToFileSelectionViaSettings(helper)) {
            return this
        }

        // 1. UIAutomator로 하단 탭 바에서 Files 탭 직접 클릭 (가장 확실)
        log("Trying UIAutomator to click Files tab...")
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        try {
            // 하단 탭 바(ion-tab-bar) 찾기
            val tabBar = device.wait(Until.findObject(By.clazz("android.view.View").desc("Tab Bar")), 5000)
                ?: device.wait(Until.findObject(By.clazz("android.widget.LinearLayout").descContains("Tab")), 3000)

            if (tabBar != null) {
                // Files 탭 버튼 찾기
                val filesTab = tabBar.getChildren().firstOrNull { 
                    (it.contentDescription?.lowercase() ?: "").contains("파일")
                        || (it.contentDescription?.lowercase() ?: "").contains("files")
                        || (it.text?.lowercase() ?: "").contains("파일")
                        || (it.text?.lowercase() ?: "").contains("files")
                        || (it.text?.lowercase() ?: "").contains("홈")
                        || (it.text?.lowercase() ?: "").contains("home") 
                }

                if (filesTab != null) {
                    filesTab.click()
                    Thread.sleep(1500)
                    val loaded2 = helper.waitForText("파일을 선택하세요", 5000)
                        || helper.waitForText("파일 생성", 5000)
                    if (loaded2) {
                        log("Successfully navigated via UIAutomator tab click")
                        return this
                    }
                }
            }

            // 탭 바를 못 찾으면 하단 화면 영역에서 텍스트로 찾기
            log("Trying to find Files tab by text...")
            val filesTabs = device.findObjects(By.text("파일").clickable(true))
            for (tab in filesTabs) {
                val bounds = tab.visibleBounds
                if (bounds != null && bounds.bottom > device.displayHeight * 0.8) { // 하단 영역
                    tab.click()
                    Thread.sleep(1500)
                    val loaded2 = helper.waitForText("파일을 선택하세요", 5000)
                        || helper.waitForText("파일 생성", 5000)
                    if (loaded2) {
                        log("Successfully navigated via UIAutomator text click")
                        return this
                    }
                }
            }

            // Files/Files 탭 찾기
            val filesTabs2 = device.findObjects(By.text("Files").clickable(true))
            for (tab in filesTabs2) {
                val bounds = tab.visibleBounds
                if (bounds != null && bounds.bottom > device.displayHeight * 0.8) {
                    tab.click()
                    Thread.sleep(1500)
                    val loaded2 = helper.waitForText("파일을 선택하세요", 5000)
                        || helper.waitForText("파일 생성", 5000)
                    if (loaded2) {
                        log("Successfully navigated via UIAutomator Files click")
                        return this
                    }
                }
            }

        } catch (e: Exception) {
            log("UIAutomator navigation failed: ${e.message}")
        }

        // 3. UIAutomator로 네이티브 백 버튼 눌러서 홈으로
        log("Trying native back button...")
        helper.goBack()
        Thread.sleep(1000)
        val loaded3 = helper.waitForText("파일을 선택하세요", 5000)
            || helper.waitForText("파일 생성", 5000)
        if (loaded3) {
            log("Successfully navigated via back button")
            return this
        }

        // 4. 최후 수단: 앱 재시작
        log("All navigation attempts failed, throwing error")
        val title = helper.getPageTitle()
        log("ensureHomeScreen FAILED - page title: $title")
        helper.dumpViewHierarchy("ensureHomeScreen_failed")
        helper.captureScreen("ensureHomeScreen_failed")
        throw AssertionError("Could not navigate to home screen. Page title: $title")
    }
}