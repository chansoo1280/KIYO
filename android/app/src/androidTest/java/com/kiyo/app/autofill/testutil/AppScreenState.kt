package com.kiyo.app.autofill.testutil

import android.util.Log

/**
 * 앱 기동 시 화면 상태 실측 스니퍼 (특정 페이지 객체에 속하지 않는 전역 상태).
 *
 * 페이지 경계를 넘는 상태 판별/화면 간 이동은 이 유틸(또는 E2EEnv)이 담당한다 —
 * HomePage가 Auth/Settings 화면을 운전하는 책임 침범을 해소하기 위해 분리됨
 * (plan 2026-08-26 리팩토링, 2026-08-27).
 */
object AppScreenState {

    enum class State {
        /** 파일 선택 화면 (활성 파일 없음) */
        NONE,

        /** 계정 리스트 화면 (비암호화 파일 활성, 또는 암호화 볼트 언락 상태) */
        PLAIN_ACTIVE,

        /** Auth 잠금 화면 (암호화 파일 활성, cryptoKey 메모리 소실 → 잠김) */
        ENCRYPTED_LOCKED,
    }

    /** 현재 화면 실측으로 상태 판별 (네비게이션 없음). */
    fun detect(helper: WebViewTestHelper): State {
        if (helper.waitForText("파일을 선택하세요", 2000) || helper.waitForText("파일 생성", 2000)) {
            Log.i(TAG, "Active state: NONE (file selection screen)")
            return State.NONE
        }
        if (helper.waitForText("KIYO 잠금 해제", 2000)) {
            Log.i(TAG, "Active state: ENCRYPTED_LOCKED (auth screen)")
            return State.ENCRYPTED_LOCKED
        }
        if (helper.waitForText("My accounts", 2000)) {
            Log.i(TAG, "Active state: PLAIN_ACTIVE (accounts list without lock)")
            return State.PLAIN_ACTIVE
        }
        Log.i(TAG, "Active state: UNKNOWN — falling back to NONE")
        return State.NONE
    }

    /**
     * Auth 잠금 화면의 뒤로가기 버튼 → closeDataFile → 파일 선택 화면 진입
     * (Auth.tsx handleBackToHome). Auth 화면 UI이므로 HomePage가 아닌 이 유틸이 담당.
     */
    fun escapeAuthToFileSelection(helper: WebViewTestHelper): Boolean = try {
        helper.log("Escaping auth screen via back button (closeDataFile)")
        val clicked = helper.clickByAriaLabel("첫 화면으로 돌아가기", "auth back button") ||
            helper.clickByXPath("//button[@aria-label='첫 화면으로 돌아가기']", "auth back button")
        if (!clicked) {
            helper.log("Auth back button not found")
            false
        } else {
            val loaded = helper.waitForText("파일을 선택하세요", 10000) ||
                helper.waitForText("파일 생성", 10000)
            if (loaded) {
                helper.log("Reached file selection screen from auth")
            } else {
                helper.dumpViewHierarchy("auth_escape_no_home")
                helper.captureScreen("auth_escape_no_home")
            }
            loaded
        }
    } catch (e: Exception) {
        helper.log("escapeAuthToFileSelection failed: ${e.message}")
        false
    }

    /**
     * Settings 탭 → 파일변경 "이동" 버튼 → 파일 선택 화면 진입.
     * Settings 화면 UI이므로 HomePage가 아닌 이 유틸이 담당.
     * 활성 볼트가 열려 있을 때(계정 리스트 등) 파일 선택 화면으로 가는 정상 UI 경로.
     * Auth 화면(잠김)에서는 Settings 탭이 없어 실패(false 반환) — 호출자가 폴백 처리.
     */
    fun navigateToFileSelectionViaSettings(helper: WebViewTestHelper): Boolean = try {
        helper.log("Trying file-change navigation: Settings tab > '이동' button")
        // Settings 화면 진입 (이미 My accounts 등 로그인 상태여야 탭이 존재)
        if (!helper.clickByAriaLabel("Settings", "settings tab")) {
            helper.log("Settings tab not found (locked auth screen?)")
            false
        } else if (!helper.waitForText("파일변경", 10000)) {
            helper.log("'파일변경' row not found on Settings")
            helper.dumpViewHierarchy("file_change_row_missing")
            false
        } else if (!helper.clickByText("이동", "file change button")) {
            helper.log("'이동' button not found")
            helper.dumpViewHierarchy("file_change_button_missing")
            false
        } else {
            val loaded = helper.waitForText("파일을 선택하세요", 10000) ||
                helper.waitForText("파일 생성", 10000)
            if (loaded) {
                helper.log("Reached file selection screen via Settings > '이동'")
            } else {
                helper.dumpViewHierarchy("file_change_no_home")
                helper.captureScreen("file_change_no_home")
            }
            loaded
        }
    } catch (e: Exception) {
        helper.log("navigateToFileSelectionViaSettings failed: ${e.message}")
        false
    }

    private const val TAG = "AppScreenState"
}
