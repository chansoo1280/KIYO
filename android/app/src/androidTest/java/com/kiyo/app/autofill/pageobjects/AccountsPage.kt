package com.kiyo.app.autofill.pageobjects

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.autofill.testutil.WebViewTestHelper

class AccountsPage(helper: WebViewTestHelper) : BasePage(helper) {

    /** 계정 페이지 로드 대기 (FAB 또는 계정 리스트 표시) */
    fun waitForLoad(): AccountsPage {
        log("waitForLoad START")
        helper.waitForWebViewReady()
        // Accounts 페이지 특징: "My accounts" 헤더 (로그 검증됨, 실제 렌더링 텍스트)
        val loaded = helper.waitForText("My accounts", 30000)
        if (!loaded) {
            // 디버깅: 현재 페이지 제목 확인
            val title = helper.getPageTitle()
            log("waitForLoad FAILED - page title: $title")
            helper.dumpViewHierarchy("waitForLoad_failed")
            helper.captureScreen("waitForLoad_failed")
            throw AssertionError("Accounts page did not load - no FAB or account list found. Page title: $title")
        }
        log("Accounts page loaded")
        return this
    }

    /** "+" FAB 클릭 -> 템플릿 선택 모달 열기 -> AccountCreatePage 반환 */
    fun clickAddAccount(): AccountCreatePage {
        log("Clicking add account FAB")
        
        // 1. Espresso-Web으로 FAB 클릭 시도
        var clicked = helper.clickByAriaLabel("Add account", "add account FAB") ||
            helper.clickByText("+", "add account FAB")
        
        // 2. UIAutomator로 FAB 직접 클릭 (bounds 기반 - 가장 확실)
        if (!clicked) {
            log("Trying UIAutomator click for FAB...")
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            try {
                // content-desc="Add account"인 버튼 찾기
                val fabButton = device.wait(Until.findObject(By.desc("Add account").clickable(true)), 5000)
                if (fabButton != null) {
                    fabButton.click()
                    Thread.sleep(1000)
                    clicked = true
                    log("FAB clicked via UIAutomator (content-desc)")
                }
            } catch (e: Exception) {
                log("UIAutomator FAB click failed: ${e.message}")
            }
        }
        
        if (!clicked) {
            throw AssertionError("Could not find add account FAB")
        }
        
        log("Add account FAB clicked, waiting for template picker modal...")
        
        // 템플릿 선택 모달(role="dialog") 나타날 때까지 대기 (로그 검증됨)
        val modalLoaded = helper.waitForElement("//div[@role='dialog']", 10000)
            || helper.waitForText("템플릿 선택", 10000)
        if (!modalLoaded) {
            log("Template picker modal did not appear")
            helper.dumpViewHierarchy("template_picker_modal_not_appeared")
            helper.captureScreen("template_picker_modal_not_appeared")
            throw AssertionError("Template picker modal did not appear after FAB click")
        }
        log("Template picker modal appeared")
        
        log("Add account FAB clicked, returning AccountCreatePage")
        return AccountCreatePage(helper)
    }
}