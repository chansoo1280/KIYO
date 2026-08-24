package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.TestDataFactory
import com.kiyo.app.autofill.testutil.WebViewTestHelper
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until

class VaultCreateDialog(helper: WebViewTestHelper) : BasePage(helper) {

    /** 비암호화 볼트 생성: 파일명 입력, 암호화 체크 해제, 생성 버튼 클릭 */
    fun createVault(fileName: String, encrypted: Boolean = true): AccountsPage {
        log("createVault START: fileName=$fileName, encrypted=$encrypted")

        // 다이얼로그 열림 대기 - "파일 이름" 라벨 (로그 검증됨: FileCreateDialog.tsx)
        log("Waiting for vault create dialog...")
        val dialogOpened = helper.waitForText("파일 이름", 10000)
        if (!dialogOpened) {
            log("Dialog not detected, dumping hierarchy...")
            helper.dumpViewHierarchy("createVault_dialog_not_found")
            helper.captureScreen("createVault_dialog_not_found")
        }
        log("Dialog opened, typing filename")

        // 파일명 입력 - id로 찾기 (로그 검증됨: FileCreateDialog.tsx의 id="vault-name-input")
        val nameTyped = helper.typeByXPath("//input[@id='vault-name-input']", fileName, "vault name input (id)")
        if (!nameTyped) {
            log("Could not find vault name input, dumping hierarchy...")
            helper.dumpViewHierarchy("createVault_no_name_input")
            helper.captureScreen("createVault_no_name_input")
            throw AssertionError("Could not find vault name input")
        }
        log("Filename typed: $fileName")

        // 파일명 입력 검증: 디폴트값("my-accounts")이 클리어됐는지 + 입력값이 정확한지 확인
        // (input value는 UIAutomator text로 안 보일 수 있어 스크린샷+덤프로 확인)
        helper.dumpViewHierarchy("after_filename_typed")
        helper.captureScreen("after_filename_typed")

        // 암호화 체크박스 처리
        if (!encrypted) {
            // 라벨 텍스트 클릭으로 체크박스 토글 (로그 검증됨: //*[contains(text(),...)] XPath만 성공)
            val checkboxClicked = helper.clickByXPath("//*[contains(text(), '파일 암호화 사용')]", "encrypt checkbox label")
            if (!checkboxClicked) throw AssertionError("Could not find encrypt checkbox")
            // 체크박스 토글 후 React 상태 업데이트 + PIN 필드 사라질 때까지 대기
            Thread.sleep(2000)
            // PIN 필드가 사라졌는지 확인 (비암호화 시)
            val startTime = System.currentTimeMillis()
            var pinFieldGone = false
            while (System.currentTimeMillis() - startTime < 10000) {
                if (!helper.waitForElement("//android.widget.EditText[@password='true']", 1000)) {
                    pinFieldGone = true
                    break
                }
                Thread.sleep(500)
            }
            if (!pinFieldGone) {
                log("WARNING: PIN field still visible after unchecking encryption - may need PIN anyway")
            } else {
                log("PIN field hidden after unchecking encryption")
            }
            log("Encryption checkbox unchecked")
            
            // React 상태 업데이트 후 버튼 활성화 대기 추가
            Thread.sleep(1000)
        } else {
            // 암호화 시 PIN 입력 필드 나타남 - PIN 입력
            val pinTyped = helper.typeByPlaceholder("6자리 PIN", TestDataFactory.TEST_PIN, "PIN input") ||
                helper.typeByInputType("password", TestDataFactory.TEST_PIN, "PIN input (type=password)")
            if (!pinTyped) throw AssertionError("Could not find PIN input for encrypted vault")
            log("PIN typed for encrypted vault")
        }

        // "생성" 버튼 대기 (로그 검증됨: //button[text()='생성']만 성공)
        log("Looking for '생성' button...")
        val createButtonFound = helper.waitForElement("//button[text()='생성']", 30000)
        if (!createButtonFound) {
            helper.dumpViewHierarchy("createVault_button_not_found")
            helper.captureScreen("createVault_button_not_found")
            throw AssertionError("Could not find '생성' button with any XPath")
        }
        
        // 폼 제출 - 로그 검증됨: //form//button[@type='submit'] 클릭이 유일한 성공 방법
        log("Attempting to submit form...")
        val submitted = helper.clickByXPath("//form//button[@type='submit']", "form submit button")
        if (submitted) log("Submitted via form submit button click")
        Thread.sleep(1500)
        log("Form submitted: $submitted")
        
        if (!submitted) {
            helper.dumpViewHierarchy("createVault_submit_failed")
            helper.captureScreen("createVault_submit_failed")
            throw AssertionError("Could not submit form with any method")
        }

        // 다이얼로그 닫힘 + 페이지 전환 대기 (WebView 내비게이션 완료 감지)
        log("Waiting for dialog to close and AccountsPage to load...")
        val navStartTime = System.currentTimeMillis()
        var pageLoaded = false
        while (System.currentTimeMillis() - navStartTime < 30000) {
            // 다이얼로그가 닫혔는지 확인 ("생성" 버튼이 사라짐)
            val dialogStillOpen = helper.waitForElement("//button[text()='생성']", 500)

            if (!dialogStillOpen) {
                // 계정 페이지 로드 확인 (로그 검증됨: "My accounts")
                if (helper.waitForText("My accounts", 3000)) {
                    pageLoaded = true
                    break
                }
            }
            Thread.sleep(1000)
        }
        
        if (!pageLoaded) {
            helper.dumpViewHierarchy("createVault_navigation_failed")
            helper.captureScreen("createVault_navigation_failed")
            throw AssertionError("Failed to navigate to AccountsPage after vault creation")
        }
        
        log("AccountsPage loaded successfully")
        return AccountsPage(helper).waitForLoad()
    }

    /** 암호화 볼트 생성 편의 메서드 */
    fun createEncryptedVault(fileName: String, pin: String = TestDataFactory.TEST_PIN): AccountsPage {
        log("createEncryptedVault START: fileName=$fileName")
        helper.waitForText("파일 이름")
        helper.typeByXPath("//input[@id='vault-name-input']", fileName, "vault name input")
            .let { if (!it) throw AssertionError("Could not find vault name input") }
        val pinTyped = helper.typeByPlaceholder("6자리 PIN", pin, "PIN input") ||
            helper.typeByInputType("password", pin, "PIN input")
        if (!pinTyped) throw AssertionError("Could not find PIN input")
        // "생성" 버튼 클릭 (활성화될 때까지 대기)
        helper.waitForElement("//button[text()='생성']", 5000)
        val clicked = helper.clickByXPath("//form//button[@type='submit']", "confirm create button (form submit)")
        if (!clicked) throw AssertionError("Could not submit vault creation form")
        log("Encrypted vault created, waiting for AccountsPage")
        return AccountsPage(helper).waitForLoad()
    }

    /** 취소 버튼 클릭 */
    fun cancel(): HomePage {
        log("Cancelling vault creation")
        val clicked = helper.clickByText("취소", "cancel button")
        if (!clicked) throw AssertionError("Could not find cancel button")
        log("Vault creation cancelled")
        return HomePage(helper)
    }
}