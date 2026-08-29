package com.kiyo.app.e2e.pageobjects

import android.util.Log
import com.kiyo.app.e2e.testutil.WebViewTestHelper

abstract class BasePage(protected val helper: WebViewTestHelper) {
    protected fun log(action: String) {
        Log.e(javaClass.simpleName, ">>> $action")
    }

    /**
     * 이 페이지를 식별하는 마커 텍스트 목록 (OR 매칭).
     * 화면 렌더링 텍스트 기준 — 각 페이지 객체가 유일한 소유자다.
     */
    protected abstract val markers: List<String>

    /**
     * 마커 텍스트 실측으로 현재 화면이 이 페이지인지 판별 (네비게이션 없음, 즉시 1회 실측).
     * 대기 없이 현재 화면만 본다 — 화면 전환 대기가 필요하면 [waitForCurrent]를 쓴다.
     */
    fun isCurrent(): Boolean = anyMarkerPresent()

    private fun anyMarkerPresent(): Boolean =
        markers.any { marker ->
            runCatching { helper.isTextPresent(marker) }.getOrDefault(false)
        }

    /**
     * 최대 [timeoutMs] 동안 폴링하며 이 페이지가 나타나기를 기다린다.
     * 매 루프에서 모든 마커를 짧게 점검하므로, 여러 페이지 후보 중 어떤 것이든
     * 먼저 나타나는 쪽이 바로 잡힌다 (순차 타임아웃 낭비 없음 — 2026-08-28).
     */
    fun waitForCurrent(timeoutMs: Long = DEFAULT_WAIT_TIMEOUT_MS): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            if (anyMarkerPresent()) return true
            runCatching { Thread.sleep(POLL_INTERVAL_MS) }
        }
        return anyMarkerPresent()
    }

    companion object {
        /** isCurrent의 기본 폴링 상한 (BasePage.waitForCurrent) */
        const val DEFAULT_WAIT_TIMEOUT_MS = 10000L

        /** waitForCurrent의 폴링 주기 */
        const val POLL_INTERVAL_MS = 300L

        /** 하위 호환 유지용 (구 순차 타임아웃 값) */
        const val DEFAULT_IS_CURRENT_TIMEOUT_MS = 2000L
    }
}
