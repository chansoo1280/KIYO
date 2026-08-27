package com.kiyo.app.e2e.pageobjects

import com.kiyo.app.e2e.testutil.TestDataFactory
import com.kiyo.app.e2e.testutil.WebViewTestHelper

class AccountEditPage(helper: WebViewTestHelper) : BasePage(helper) {

    /** 모달 컴포넌트 — 단독 화면 판별 대상 아님 */
    override val markers: List<String> = emptyList()

    data class AccountData(
        val title: String = "Test Account",
        val websiteUrl: String = "https://example.com",
        val username: String = "testuser",
        val password: String = "testpass123",
        val memo: String? = null,
        val packageName: String? = null
    )

    /** AccountEdit 페이지 로드 대기 */
    fun waitForLoad(): AccountEditPage {
        helper.waitForWebViewReady()
        // AccountEdit 페이지의 특징: "저장" 버튼 (로그 검증됨)
        val loaded = helper.waitForText("저장", 15000)
        if (!loaded) {
            val title = helper.getPageTitle()
            log("AccountEditPage waitForLoad FAILED - page title: $title")
            throw AssertionError("AccountEdit page did not load. Page title: $title")
        }
        log("AccountEdit page loaded")
        return this
    }

    /** 계정 폼 작성 (웹 UI에 표시되는 필드만) */
    fun fillAccount(data: AccountData): AccountEditPage {
        log("Filling account form: ${data.title}")

        // 제목 (라벨: "제목") - label로 찾기
        if (!helper.typeByLabel("제목", data.title, "title input")) {
            throw AssertionError("Could not find title input")
        }
        log("Title filled: ${data.title}")

        // 웹사이트 URL (라벨: "웹사이트 URL (자동완성용)") - label로 찾기
        if (!helper.typeByLabel("웹사이트 URL (자동완성용)", data.websiteUrl, "website input")) {
            throw AssertionError("Could not find website input")
        }
        log("Website URL filled: ${data.websiteUrl}")

        // 안드로이드 패키지명 (라벨: "안드로이드 패키지명 (자동완성용)") - label로 찾기
        data.packageName?.let { pkg ->
            if (!helper.typeByLabel("안드로이드 패키지명 (자동완성용)", pkg, "package name input")) {
                log("Package name field not found, skipping")
            }
            log("Package name filled: $pkg")
        }

        // 사용자명/이메일 (기본 템플릿의 "아이디/이메일" 필드 대응) - 필드 라벨로 값 입력란 찾기
        val usernameEntered = helper.typeByFieldLabel("아이디/이메일", data.username, "username input (KR)") ||
            helper.typeByFieldLabel("이메일", data.username, "username input (KR alt)") ||
            helper.typeByFieldLabel("Email", data.username, "username input (EN)") ||
            helper.typeByFieldLabel("사용자", data.username, "username input (alt)")
        if (!usernameEntered) throw AssertionError("Could not find username/email input")
        log("Username filled: ${data.username}")

        // 비밀번호 - 필드 라벨로 값 입력란 찾기
        val passwordEntered = helper.typeByFieldLabel("비밀번호", data.password, "password input") ||
            helper.typeByFieldLabel("Password", data.password, "password input (EN)")
        if (!passwordEntered) throw AssertionError("Could not find password input")
        log("Password filled")

        // 메모 (선택사항) - 필드 라벨로 값 입력란 찾기
        data.memo?.let { memo ->
            if (helper.typeByFieldLabel("메모", memo, "memo input") ||
                helper.typeByFieldLabel("Memo", memo, "memo input (EN)")) {
                log("Memo filled")
            }
        }

        // 입력 검증: 각 input의 실제 value를 덤프 (React state까지 전달됐는지 확인)
        verifyFilledValues(data)

        // 저장 직전 화면 상태 캡처 (스크린샷 + UI 계층 덤프)

        log("Account form filled completely")
        return this
    }

    /** 폼 입력 후 각 input의 실제 value 확인 (Espresso-Web으로 DOM 값 읽기) */
    private fun verifyFilledValues(data: AccountData) {
        log("=== Verifying filled input values ===")
        val checks = listOf(
            "title" to "//label[contains(text(), '제목')]/input[@data-field-value='true']",
            "website" to "//label[contains(text(), '웹사이트 URL')]/input[@data-field-value='true']",
        )
        for ((name, xpath) in checks) {
            val value = helper.readInputValue(xpath)
            log("VERIFY $name: '$value' (expected contains '${if (name == "title") data.title else data.websiteUrl}')")
        }
        // 동적 필드 (사용자명/비밀번호): placeholder 기반 컨테이너 내 data-field-value 값
        val usernameValue = helper.readInputValue(
            "//input[@placeholder='항목 이름' and @value='아이디/이메일']/ancestor::div[contains(@class,'rounded-2xl')]//*[@data-field-value='true']"
        )
        log("VERIFY username: '$usernameValue' (expected '${data.username}')")
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

        log("Save triggered, waiting for navigation...")

        // 현재 페이지 확인
        val currentTitle = helper.getPageTitle()
        log("Current page after save: $currentTitle")
        
        // Account Detail 페이지("← 뒤로 가기", "수정", "삭제" 버튼)인지 확인 (로그/소스 검증됨)
        val isDetailPage = helper.waitForText("← 뒤로 가기", 3000)
            || helper.waitForText("수정", 3000)
            || helper.waitForText("삭제", 3000)

        // 디테일 화면 상태 캡처 (저장된 값이 실제로 보이는지 확인용)
        if (isDetailPage) {
        }

        if (isDetailPage) {
            log("On Account Detail page, navigating back to Accounts list...")
            // 뒤로 가기 버튼 클릭 (소스 검증됨: AccountDetail "← 뒤로 가기", AccountEdit "← 취소")
            val backClicked = helper.clickByText("← 뒤로 가기", "back button (AccountDetail)")
                ?: helper.clickByText("← 취소", "back button (AccountEdit)")
                ?: helper.clickByXPath("//button[contains(., '←')]", "back button")

            if (!backClicked) {
                // goBack()으로 네이티브 백 버튼 누르기
                helper.goBack()
            }
        }
        
        // Accounts 페이지 로드 대기
        log("Waiting for Accounts page...")
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