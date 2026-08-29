package com.kiyo.app.e2e.pageobjects

import com.kiyo.app.e2e.testutil.TestDataFactory
import com.kiyo.app.e2e.testutil.WebViewTestHelper

class AccountCreatePage(helper: WebViewTestHelper) : BasePage(helper) {

    /** 모달 컴포넌트 — 단독 화면 판별 대상 아님 */
    override val markers: List<String> = emptyList()

    data class AccountData(
        val title: String = "Test Account",
        val websiteUrl: String = "https://example.com",
        val username: String = "testuser",
        val password: String = "testpass123",
        val memo: String? = null
        // packageName은 웹 UI에서 입력하지 않음 (React 계정 생성 화면에 없음)
        // 자동완성 동기화 시 repository 레벨에서 설정됨
    )

    /** 템플릿 선택 (기본 템플릿) -> AccountEdit 페이지로 이동 */
        fun selectDefaultTemplate(): AccountEditPage {
            log("Selecting default template")

            // TemplatePicker 구조: <div role="dialog"> 내부의 <button>들
            // (로그 검증됨: dialog XPath가 항상 첫 시도에 성공)
            val clicked = helper.clickByXPath("//div[@role='dialog']//button[contains(., '기본 템플릿')]", "default template in dialog")

            if (!clicked) {
                throw AssertionError("Could not find default template option")
            }
        
        log("Default template selected, waiting for AccountEdit page...")
        
        // AccountEdit 페이지 로드 대기 (네비게이션 + 렌더링)
        val accountEditPage = AccountEditPage(helper)
        val loaded = accountEditPage.waitForLoad() != null
        if (!loaded) {
            throw AssertionError("AccountEdit page did not load after template selection")
        }
        log("AccountEdit page loaded successfully")
        return accountEditPage
    }

    /** 계정 폼 작성 (웹 UI에 표시되는 필드만) */
    fun fillAccount(data: AccountData): AccountCreatePage {
        log("Filling account form: ${data.title}")

        // 제목 (플레이스홀더: "제목" 또는 "Title")
        if (!helper.typeByPlaceholder("제목", data.title, "title input") &&
            !helper.typeByPlaceholder("Title", data.title, "title input (EN)")) {
            throw AssertionError("Could not find title input")
        }
        log("Title filled: ${data.title}")

        // 웹사이트 URL (플레이스홀더: "웹사이트" 또는 "Website")
        if (!helper.typeByPlaceholder("웹사이트", data.websiteUrl, "website input") &&
            !helper.typeByPlaceholder("Website", data.websiteUrl, "website input (EN)")) {
            throw AssertionError("Could not find website input")
        }
        log("Website URL filled: ${data.websiteUrl}")

        // 사용자명/이메일 (여러 플레이스홀더 시도)
        val usernameEntered = helper.typeByPlaceholder("이메일", data.username, "username input") ||
            helper.typeByPlaceholder("Email", data.username, "username input (EN)") ||
            helper.typeByPlaceholder("사용자", data.username, "username input (alt)") ||
            helper.typeByInputType("email", data.username, "email input")
        if (!usernameEntered) throw AssertionError("Could not find username/email input")
        log("Username filled: ${data.username}")

        // 비밀번호 (플레이스홀더: "비밀번호" 또는 "Password", 타입: password)
        val passwordEntered = helper.typeByPlaceholder("비밀번호", data.password, "password input") ||
            helper.typeByPlaceholder("Password", data.password, "password input (EN)") ||
            helper.typeByInputType("password", data.password, "password input")
        if (!passwordEntered) throw AssertionError("Could not find password input")
        log("Password filled")

        // 메모 (선택사항)
        data.memo?.let { memo ->
            if (helper.typeByPlaceholder("메모", memo, "memo input") ||
                helper.typeByPlaceholder("Memo", memo, "memo input (EN)")) {
                log("Memo filled")
            }
        }

        log("Account form filled completely")
        return this
    }

    /** "저장" 버튼 클릭 -> 계정 리스트로 복귀 */
        fun save(): AccountsPage {
            log("Saving account")

            // AccountEdit 페이지: <button type="button" onClick={handleSave}>저장</button>
            // form submit이 아님 - 버튼 클릭으로 handleSave() 직접 호출 (로그 검증됨: clickByText 성공)
            val saved = helper.clickByText("저장", "save button")
            log("clickByText('저장'): $saved")

            if (!saved) {
                // 디버깅: 현재 페이지 덤프
                throw AssertionError("Could not find/save button or submit form")
            }

            log("Save triggered, waiting for AccountsPage")
            val accountsPage = AccountsPage(helper).waitForLoad()

            log("AccountsPage loaded after save")

            return accountsPage
        }

    /** 취소 */
    fun cancel(): AccountsPage {
        log("Cancelling account creation")
        val clicked = helper.clickByText("취소", "cancel button") ||
            helper.clickByText("Cancel", "cancel button (EN)")
        if (!clicked) throw AssertionError("Could not find cancel button")
        log("Account creation cancelled")
        return AccountsPage(helper).waitForLoad()
    }
}