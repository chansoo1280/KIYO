package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper

class TemplatePickerDialog(helper: WebViewTestHelper) : BasePage(helper) {

    fun selectTemplate(templateName: String): AccountCreatePage {
        log("Selecting template: $templateName")
        if (!helper.clickByText(templateName, "template option")) {
            throw AssertionError("Template not found: $templateName")
        }
        return AccountCreatePage(helper)
    }

    fun selectDefaultTemplate(): AccountCreatePage = selectTemplate("기본 템플릿")
}