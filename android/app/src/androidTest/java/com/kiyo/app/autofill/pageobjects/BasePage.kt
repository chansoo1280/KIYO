package com.kiyo.app.autofill.pageobjects

import android.util.Log
import com.kiyo.app.autofill.testutil.WebViewTestHelper

abstract class BasePage(protected val helper: WebViewTestHelper) {
    protected fun log(action: String) {
        Log.e(javaClass.simpleName, ">>> $action")
    }
}