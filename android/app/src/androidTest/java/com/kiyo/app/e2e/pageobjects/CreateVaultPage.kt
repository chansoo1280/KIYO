package com.kiyo.app.e2e.pageobjects

import com.kiyo.app.e2e.testutil.TestDataFactory
import com.kiyo.app.e2e.testutil.WebViewTestHelper

/**
 * Plan-7a: /create-vault 페이지 기반 vault 생성 흐름 (Vault Creation).
 *
 * 흐름:
 * 1. Step 1 (이름): 파일 이름 입력 → "다음" 클릭
 * 2. Step 2 (PIN):
 *    - encrypted=true (default): PIN 입력 → "생성" 클릭
 *    - encrypted=false: "비밀번호 없이 만들기" 클릭 (Plan-7a에서 비암호화 경로 유지)
 * 3. /accounts 페이지 도달 대기 → AccountsPage 반환
 *
 * 호출 진입점: [HomePage.clickCreateVaultButton] (Home의 "파일 생성" Link 클릭).
 *
 * 셀렉터 (CreateVault/index.tsx, NameStep.tsx, PinStep.tsx):
 *  - Step 1 입력:    id="vault-name", data-testid="create-vault-name-input"
 *  - "다음" 버튼:    data-testid="create-vault-next"
 *  - Step 2 PIN:    id="pin", type="password", data-testid="create-vault-pin-input",
 *                   placeholder="4~20자 PIN" (Plan-4 PIN 정책)
 *  - "이전" 버튼:    data-testid="create-vault-back"
 *  - "생성" 버튼:    data-testid="create-vault-submit"  (type="button", form wrapper 없음)
 *  - "비밀번호 없이 만들기": data-testid="create-vault-skip-pin"
 *
 * 주의: 구 FileCreateDialog는 모달 기반이었으나 (id="vault-name-input", form wrapper,
 * type="submit", placeholder="6자리 PIN") Plan-7a 1차 PR(e878f85b)에서 완전히 사라짐.
 * 이 pageobject는 그것을 페이지 기반 흐름으로 재작성한 것.
 */
class CreateVaultPage(helper: WebViewTestHelper) : BasePage(helper) {

    /** 모달 컴포넌트가 아닌 페이지 흐름 — 단독 화면 판별 대상이 아님 */
    override val markers: List<String> = emptyList()

    /**
     * /create-vault 페이지 2단계 흐름으로 vault 생성.
     *
     * @param fileName 입력할 파일 이름 (확장자 제외). CreateVaultPage가 `.json` 자동 부여.
     * @param encrypted true면 PIN 입력 후 "생성", false면 "비밀번호 없이 만들기".
     */
    fun createVault(fileName: String, encrypted: Boolean = true): AccountsPage {
        log("createVault START: fileName=$fileName, encrypted=$encrypted")

        // Step 1 표시 대기 (헤더 "새 파일 생성" 또는 라벨 "파일 이름" 중 먼저 나타나는 쪽)
        helper.waitForText("새 파일 생성", 10000) ||
            helper.waitForText("파일 이름", 10000) ||
            run {
                log("Step 1 not detected, dumping hierarchy...")
                false
            }
        log("Step 1 detected, typing filename")

        // Step 1: 파일명 입력 — 새 마크업은 id="vault-name" (구 "-input" suffix 없음)
        val nameTyped = helper.typeByXPath("//input[@id='vault-name']", fileName, "vault name input")
        if (!nameTyped) {
            throw AssertionError("Could not find vault name input (id='vault-name')")
        }
        log("Filename typed: $fileName")

        // "다음" 버튼 — data-testid 기반. Step 1에서는 "다음"만 노출, "생성"은 Step 2.
        val nextClicked = helper.clickByXPath(
            "//*[@data-testid='create-vault-next']",
            "next button (Step 1)",
        )
        if (!nextClicked) {
            throw AssertionError("Could not find '다음' button (data-testid='create-vault-next')")
        }
        log("Next clicked, waiting for Step 2...")

        // Step 2 진입 대기: Stepper가 PIN 단계로 전환되고 PIN 입력 노출
        if (!helper.waitForText("PIN 설정", 10000) &&
            !helper.waitForText("PIN 번호", 10000)
        ) {
            throw AssertionError("Step 2 (PIN) did not load after '다음' click")
        }

        // Step 2: PIN 입력 또는 비암호화 분기
        if (encrypted) {
            // PIN 입력 — placeholder는 "4~20자 PIN" (Plan-4 정책, 구 "6자리 PIN" 폐기)
            val pinTyped = helper.typeByPlaceholder("4~20자 PIN", TestDataFactory.TEST_PIN, "PIN input") ||
                helper.typeByXPath(
                    "//input[@type='password']",
                    TestDataFactory.TEST_PIN,
                    "PIN input (type=password fallback)",
                )
            if (!pinTyped) {
                throw AssertionError("Could not find PIN input for encrypted vault")
            }
            log("PIN typed for encrypted vault")

            // "생성" 버튼 — type="button" (구 FileCreateDialog의 form submit wrapper 없음)
            val submitClicked = helper.clickByXPath(
                "//*[@data-testid='create-vault-submit']",
                "submit button (Step 2)",
            )
            if (!submitClicked) {
                throw AssertionError("Could not find '생성' button (data-testid='create-vault-submit')")
            }
        } else {
            // 비암호화 — "비밀번호 없이 만들기" 버튼 (Plan-7a 결정, Step 2 우측 하단 텍스트 링크)
            val skipClicked = helper.clickByXPath(
                "//*[@data-testid='create-vault-skip-pin']",
                "skip pin button (Step 2)",
            )
            if (!skipClicked) {
                throw AssertionError(
                    "Could not find '비밀번호 없이 만들기' button (data-testid='create-vault-skip-pin')",
                )
            }
            log("Plain vault: '비밀번호 없이 만들기' clicked")
        }

        // /accounts 도달 대기 — 다이얼로그 닫힘 폴링이 아닌 페이지 마커 확인
        log("Waiting for /accounts navigation...")
        val navStartTime = System.currentTimeMillis()
        var pageLoaded = false
        while (System.currentTimeMillis() - navStartTime < 30000) {
            if (helper.waitForText(AccountsPage.MARKER_TEXT, 1000)) {
                pageLoaded = true
                break
            }
            Thread.sleep(500)
        }

        if (!pageLoaded) {
            throw AssertionError("Failed to navigate to AccountsPage after vault creation")
        }

        log("AccountsPage loaded successfully")
        return AccountsPage(helper).waitForLoad()
    }

    /**
     * Step 2 → Step 1 "이전" 버튼 클릭 후 Step 1 화면 도달 대기.
     * 현재 Android E2E 호출처 없음 — Plan-7a "이전 + PIN 클리어" 시나리오를
     * 향후 Android E2E에서 재현할 때 사용 가능 (React E2E에서 검증됨).
     */
    fun backToNameStep(): Boolean {
        val backClicked = helper.clickByXPath(
            "//*[@data-testid='create-vault-back']",
            "back button (Step 2)",
        )
        if (!backClicked) return false
        return helper.waitForText("새 파일 이름", 10000)
    }
}