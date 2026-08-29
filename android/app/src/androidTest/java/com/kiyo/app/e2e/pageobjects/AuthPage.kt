package com.kiyo.app.e2e.pageobjects

import com.kiyo.app.e2e.testutil.WebViewTestHelper

/**
 * Auth 잠금 화면 (Auth.tsx) 페이지 객체.
 *
 * 생체인증 E2E(BiometricUnlockE2ETest)가 테스트 클래스 안에서 직접 운전하던
 * Auth 화면 UI 조작을 페이지 경계에 맞게 이관함 (2026-08-27 리팩토링).
 * Auth 화면 탈출(뒤로가기 → 파일 선택 화면)도 본 페이지가 담당 (2026-08-28).
 */
class AuthPage(helper: WebViewTestHelper) : BasePage(helper) {

    override val markers = listOf(MARKER_TEXT)

    companion object {
        /** Auth 잠금 화면 마커 (Auth.tsx 렌더링 텍스트) */
        const val MARKER_TEXT = "KIYO 잠금 해제"
        /** 파일 선택 화면 마커 (Home.tsx 렌더링 텍스트 — HomePage와 공유하는 경계 텍스트) */
        const val FILE_SELECT_MARKER = "파일을 선택하세요"
        const val CREATE_FILE_MARKER = "파일 생성"

        /** 페이지 객체 인스턴스 없이 마커 실측 (isCurrent의 static 형태). */
        fun isCurrentVia(helper: WebViewTestHelper, timeoutMs: Long = 500): Boolean =
            runCatching { helper.waitForText(MARKER_TEXT, timeoutMs) }.getOrDefault(false)
    }

    /** Auth 화면 진입 대기 ("KIYO 잠금 해제" 헤더 실측). */
    fun waitForScreen(timeoutMs: Long = 15000) {
        if (!helper.waitForText(MARKER_TEXT, timeoutMs)) {
            throw AssertionError("Auth screen not shown after lock")
        }
        log("Auth screen visible")
    }

    /** 지문 로그인 버튼 노출 여부 (hasKey && isBiometryAvailable일 때만 노출 — Auth.tsx). */
    fun waitForFingerprintButton(timeoutMs: Long = 8000): Boolean =
        helper.waitForText("지문으로 로그인", timeoutMs)

    /**
     * 지문 로그인 버튼 클릭 후 프롬프트 렌더링 대기.
     * 프롬프트는 접근성 트리에 노출되지 않으므로(보안 정책) 렌더링 대기 후 onPromptVisible
     * 콜백을 호출한다 — 호출자가 logcat 마커 출력 등 호스트 협력 동작을 수행.
     */
    fun tapFingerprintLogin(onPromptVisible: () -> Unit) {
        if (!waitForFingerprintButton()) {
            throw AssertionError("Fingerprint login button not shown on auth screen")
        }
        if (!helper.clickByText("지문으로 로그인", "biometric login button")) {
            throw AssertionError("Could not click fingerprint login button")
        }

        // 네이티브 프롬프트 렌더링 대기 후 콜백 (호스트 finger touch 주입)
        log("Waiting for native BiometricPrompt to render...")
        Thread.sleep(4000)
        onPromptVisible()
    }

    /** PIN 입력으로 Auth 화면 언락하고 계정 리스트 도달까지 대기 (Auth.tsx handleVerifyPin). */
    fun unlockWithPin(pin: String) {
        // 이미 언락된 세션(계정 리스트 표시)이면 아무것도 하지 않는다 — 멱등 (2026-08-28).
        if (AccountsPage.MARKER_TEXT.let { helper.isTextPresent(it) }) {
            log("Already unlocked — skip PIN entry")
            return
        }

        val typed = helper.typeByXPath("//input[@id='pin']", pin, "auth pin input") ||
            helper.typeByInputType("password", pin, "auth pin input fallback")
        if (!typed) throw AssertionError("Could not type PIN on auth screen")

        // 입력 필드가 실제로 존재하고 포커스 가능한 상태인지 확인
        // (readInputValue는 value 미노출로 "FOUND"/"ELEMENT_NOT_FOUND"를 반환)
        val fieldPresent = runCatching { helper.readInputValue("//input[@id='pin']") }.getOrNull() == "FOUND" ||
            runCatching { helper.readInputValue("//input[@type='password']") }.getOrNull() == "FOUND"
        if (!fieldPresent) {
            throw AssertionError("PIN input field not found on auth screen")
        }

        if (!helper.clickByText("확인", "auth confirm button")) {
            throw AssertionError("Could not tap auth confirm button")
        }
        if (!helper.waitForText(AccountsPage.MARKER_TEXT, 15000)) {
            // 에러 메시지(잘못된 PIN 등)가 떠 있으면 실패 원인을 명확히 전달
            val errHint = runCatching { helper.getTextByXPath("//*[contains(@class,'error') or contains(text(),'일치하지')]") }.getOrNull()
            throw AssertionError(
                "Accounts list did not appear after PIN unlock${if (errHint.isNullOrBlank()) "" else " — screen hint: $errHint"}"
            )
        }
        log("Vault unlocked with PIN")
    }

    /**
     * Auth 잠금 화면의 뒤로가기 버튼 → closeDataFile → 파일 선택 화면 진입
     * (Auth.tsx handleBackToHome). Auth 화면 UI 운전이므로 본 페이지가 담당.
     * (구 AppScreenState.escapeAuthToFileSelection — 2026-08-28 이관)
     */
    fun escapeToFileSelection(): Boolean = try {
        helper.log("Escaping auth screen via back button (closeDataFile)")
        val clicked = helper.clickByAriaLabel("첫 화면으로 돌아가기", "auth back button") ||
            helper.clickByXPath("//button[@aria-label='첫 화면으로 돌아가기']", "auth back button")
        if (!clicked) {
            helper.log("Auth back button not found")
            false
        } else {
            val loaded = helper.waitForText(FILE_SELECT_MARKER, 10000) ||
                helper.waitForText(CREATE_FILE_MARKER, 10000)
            if (loaded) {
                helper.log("Reached file selection screen from auth")
            } else {
                helper.log("File selection screen did not load from auth escape")
            }
            loaded
        }
    } catch (e: Exception) {
        helper.log("escapeToFileSelection failed: ${e.message}")
        false
    }
}
