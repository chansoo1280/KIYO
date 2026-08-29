package com.kiyo.app.e2e.pageobjects

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.e2e.testutil.WebViewTestHelper
import java.io.File

class HomePage(helper: WebViewTestHelper) : BasePage(helper) {

    override val markers = listOf(FILE_SELECT_MARKER, CREATE_FILE_MARKER)

    companion object {
        /** 파일 선택 화면 마커 (Home.tsx 렌더링 텍스트) */
        const val FILE_SELECT_MARKER = "파일을 선택하세요"
        const val CREATE_FILE_MARKER = "파일 생성"
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
        helper.waitForText(CREATE_FILE_MARKER) // "파일 생성" 버튼이 보이면 로드 완료
        log("HomePage loaded")
        return this
    }

    /** 홈 화면(파일 선택 화면) 대기 - "파일을 선택하세요" 텍스트 확인 */

    /** 앱 상태 무관하게 홈 화면(파일 탭)으로 강제 이동.
     *  볼트가 이미 열려 있으면(계정 리스트 등) 파일 탭이 아니라도 정상 상태이므로 통과시킨다. */
}
