package com.kiyo.app.e2e.pageobjects

import com.kiyo.app.e2e.testutil.WebViewTestHelper

class TemplatePickerDialog(helper: WebViewTestHelper) : BasePage(helper) {

    /** 모달 컴포넌트 — 단독 화면 판별 대상 아님 */
    override val markers: List<String> = emptyList()

    fun selectTemplate(templateName: String): AccountCreatePage {
        log("Selecting template: $templateName")
        if (!helper.clickByText(templateName, "template option")) {
            throw AssertionError("Template not found: $templateName")
        }
        return AccountCreatePage(helper)
    }

    fun selectDefaultTemplate(): AccountCreatePage = selectTemplate("기본 템플릿")
}