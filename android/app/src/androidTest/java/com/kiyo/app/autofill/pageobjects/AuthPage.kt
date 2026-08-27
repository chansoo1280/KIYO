package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper

/**
 * Auth 잠금 화면 (Auth.tsx) 페이지 객체.
 *
 * 생체인증 E2E(BiometricUnlockE2ETest)가 테스트 클래스 안에서 직접 운전하던
 * Auth 화면 UI 조작을 페이지 경계에 맞게 이관함 (2026-08-27 리팩토링).
 */
class AuthPage(helper: WebViewTestHelper) : BasePage(helper) {

    /** Auth 화면 진입 대기 ("KIYO 잠금 해제" 헤더 실측). */
    fun waitForScreen(timeoutMs: Long = 15000) {
        if (!helper.waitForText("KIYO 잠금 해제", timeoutMs)) {
            helper.dumpViewHierarchy("auth_screen_missing")
            helper.captureScreen("auth_screen_missing")
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
        val typed = helper.typeByXPath("//input[@id='pin']", pin, "auth pin input") ||
            helper.typeByInputType("password", pin, "auth pin input fallback")
        if (!typed) throw AssertionError("Could not type PIN on auth screen")
        Thread.sleep(500)
        if (!helper.clickByText("확인", "auth confirm button")) {
            throw AssertionError("Could not tap auth confirm button")
        }
        if (!helper.waitForText("My accounts", 15000)) {
            helper.dumpViewHierarchy("pin_unlock_no_accounts")
            helper.captureScreen("pin_unlock_no_accounts")
            throw AssertionError("Accounts list did not appear after PIN unlock")
        }
        log("Vault unlocked with PIN")
    }
}
