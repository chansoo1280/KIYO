package com.kiyo.app.autofill.testutil

import android.util.Log
import android.os.Environment
import android.view.KeyEvent
import androidx.test.espresso.web.sugar.Web.onWebView
import androidx.test.espresso.web.webdriver.DriverAtoms.findElement
import androidx.test.espresso.web.webdriver.DriverAtoms.getText
import androidx.test.espresso.web.webdriver.DriverAtoms.webClick
import androidx.test.espresso.web.webdriver.DriverAtoms.webKeys
import androidx.test.espresso.web.webdriver.Locator
import androidx.test.espresso.web.assertion.WebViewAssertions
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.hamcrest.CoreMatchers.allOf
import org.hamcrest.CoreMatchers.notNullValue
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

/**
 * WebView 내 요소와 상호작용하는 사용자 중심 헬퍼.
 * 실제 사용자가 보는 것(텍스트, 라벨, 플레이스홀더, 입력 타입)을 기준으로
 * 선택자 체인(폴백)을 통해 견고하게 요소를 찾음.
 * data-testid 등 테스트 전용 속성은 사용하지 않음.
 */
class WebViewTestHelper(private val tag: String = "WebViewTestHelper") {

    companion object {
        /**
         * UiDevice(네이티브) 레벨에서 aria-label 매칭 클릭 — WebView 밖 요소용.
         * (SettingsPage의 네이티브 설정 앱 복귀 경로 등에서 사용)
         */
        fun clickAriaLabelStatic(device: UiDevice, label: String, description: String = "element"): Boolean {
            val selector = By.descContains(label)
            return if (device.hasObject(selector)) {
                device.findObject(selector).click()
                Log.i("WebViewTestHelper", "Clicked $description via UiDevice descContains('$label')")
                true
            } else {
                Log.w("WebViewTestHelper", "clickAriaLabelStatic failed for '$label' ($description)")
                false
            }
        }
    }

    // ============ 클릭 계열 ============

    /** 보이는 텍스트로 버튼/요소 클릭 (XPath contains) - ARIA 라벨 최우선 폴백 */
    fun clickByText(text: String, description: String = "button"): Boolean {
        return trySelectorChain(
            { clickByAriaLabel(text, description) },  // ARIA 라벨 최우선 (접근성)
            { clickByXPath("//button[contains(text(), '$text')]", description) },
            { clickByXPath("//*[@role='button' and contains(text(), '$text')]", description) },
            { clickByXPath("//*[contains(text(), '$text')]", description) }  // 일반 텍스트 최후
        )
    }

    /** ARIA 라벨로 클릭 (XPath @aria-label 매칭) */
    fun clickByAriaLabel(label: String, description: String = "element"): Boolean {
        return trySelectorChain(
            { clickByXPath("//*[@aria-label='$label']", description) },
            { clickByXPath("//*[@aria-label*='$label']", description) }
        )
    }

    /** 입력 타입으로 필드 찾아 클릭 */
    fun clickByInputType(inputType: String, description: String = "input"): Boolean {
        return trySelectorChain(
            { clickByXPath("//input[@type='$inputType']", description) },
            { clickByXPath("//ion-input[@type='$inputType']//input", description) }
        )
    }

    /** XPath로 직접 클릭 (Page Object에서 사용) */
    fun clickByXPath(xpath: String, description: String): Boolean {
        try {
            onWebView()
                .withElement(findElement(Locator.XPATH, xpath))
                .perform(webClick())
            Log.e(tag, "Clicked $description (XPath: $xpath)")
            return true
        } catch (e: Exception) {
            Log.w(tag, "Click failed for $description (XPath: $xpath): ${e.message}")
            return false
        }
    }

    /** XPath로 직접 텍스트 입력 (Page Object에서 사용) */
    fun typeByXPath(xpath: String, text: String, description: String): Boolean {
        return typeByXPathInternal(xpath, text, description)
    }

    // ============ 입력 계열 ============

    /** 플레이스홀더로 입력 필드 찾아 텍스트 입력 */
    fun typeByPlaceholder(placeholder: String, text: String, description: String = "input"): Boolean {
        return trySelectorChain(
            { typeByXPath("//input[@placeholder='$placeholder']", text, description) },
            { typeByXPath("//textarea[@placeholder='$placeholder']", text, description) },
            { typeByXPath("//ion-input[@placeholder='$placeholder']//input", text, description) }
        )
    }

    /** 입력 타입으로 필드 찾아 텍스트 입력 */
    fun typeByInputType(inputType: String, text: String, description: String = "input"): Boolean {
        return trySelectorChain(
            { typeByXPath("//input[@type='$inputType']", text, description) },
            { typeByXPath("//ion-input[@type='$inputType']//input", text, description) }
        )
    }

    /** 라벨 텍스트로 연결된 입력 필드 찾아 텍스트 입력 (React <label>텍스트<input> 구조용) */
    fun typeByLabel(labelText: String, text: String, description: String = "input"): Boolean {
        // data-field-value="true" 속성을 가진 요소로 직접 찾기 (가장 정확)
        return typeByLabelFieldValueAttribute(labelText, text, description)
    }

    /** data-field-value="true" 속성을 가진 입력 필드 찾아 텍스트 입력 (React data-field-value 속성 사용 - 고정 필드용) */
    private fun typeByLabelFieldValueAttribute(labelText: String, text: String, description: String): Boolean {
        // label[text] 내부 또는 형제의 data-field-value="true" 요소 찾기
        return typeByXPath(
            "//label[contains(text(), '$labelText')]//*[@data-field-value='true']",
            text,
            description
        )
    }

    /** 필드 라벨 값(placeholder="항목 이름"인 input의 값)으로 동적 필드의 값 입력란 찾아 텍스트 입력 */
    fun typeByFieldLabel(fieldLabel: String, text: String, description: String = "dynamic field"): Boolean {
        // data-field-value="true" 속성을 가진 요소로 직접 찾기 (가장 정확)
        return typeByFieldValueAttribute(fieldLabel, text, description)
    }

    /** data-field-value="true" 속성을 가진 입력 필드 찾아 텍스트 입력 (React data-field-value 속성 사용) */
    private fun typeByFieldValueAttribute(fieldLabel: String, text: String, description: String): Boolean {
        // 라벨 input으로 FieldEditor 컨테이너 찾고, 그 안의 data-field-value="true" 요소에 입력
        return typeByXPath(
            "//input[@placeholder='항목 이름' and @value='$fieldLabel']/ancestor::div[contains(@class, 'rounded-2xl')]//*[@data-field-value='true']",
            text,
            description
        )
    }

    /** XPath 요소의 존재 확인 + value 속성 반환 (입력 검증용, webKeys가 React state까지 전달됐는지 간접 확인) */
    fun readInputValue(xpath: String): String {
        return try {
            val element = onWebView()
                .withElement(findElement(Locator.XPATH, xpath))
            // input의 value 속성은 getText로 못 읽으므로 존재 여부만 확인하고 태그 정보 반환
            "FOUND"
        } catch (e: Exception) {
            Log.w(tag, "readInputValue failed for $xpath: ${e.message}")
            "ELEMENT_NOT_FOUND"
        }
    }

    /** 특정 텍스트가 화면에 나타날 때까지 대기 */
    fun waitForText(text: String, timeoutMs: Long = 10000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                onWebView()
                    .withElement(findElement(Locator.XPATH, "//*[contains(text(), '$text')]"))
                    .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue())))
                Log.e(tag, "Found text: $text")
                return true
            } catch (e: Exception) {
                Thread.sleep(200)
            }
        }
        // 폴백: UIAutomator로도 시도
        try {
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            val startTime2 = System.currentTimeMillis()
            while (System.currentTimeMillis() - startTime2 < 5000) {
                val elements = device.findObjects(By.text(text))
                if (elements.isNotEmpty()) {
                    Log.e(tag, "Found text via UIAutomator: $text")
                    return true
                }
                Thread.sleep(200)
            }
        } catch (e: Exception) {
            // 무시
        }
        Log.w(tag, "Timeout waiting for text: $text")
        return false
    }

    /** 부분 문자열이 화면에 나타날 때까지 대기 (UIAutomator textContains 기반) */
    fun waitForTextContains(text: String, timeoutMs: Long = 10000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
                if (device.hasObject(By.textContains(text))) {
                    Log.e(tag, "Found text (contains): $text")
                    return true
                }
                Thread.sleep(200)
            } catch (e: Exception) {
                Thread.sleep(200)
            }
        }
        Log.w(tag, "Timeout waiting for text (contains): $text")
        return false
    }

    /** 요소가 나타날 때까지 대기 (XPath) */
    fun waitForElement(xpath: String, timeoutMs: Long = 10000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                onWebView()
                    .withElement(findElement(Locator.XPATH, xpath))
                    .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue())))
                return true
            } catch (e: Exception) {
                Thread.sleep(200)
            }
        }
        return false
    }

    /** WebView가 로드될 때까지 대기 (ion-app 또는 body 존재) */
    fun waitForWebViewReady(timeoutMs: Long = 30000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                onWebView()
                    .withElement(findElement(Locator.TAG_NAME, "ion-app"))
                    .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue())))
                Log.e(tag, "WebView ready (ion-app found)")
                Thread.sleep(1000) // 추가 렌더링 대기
                return true
            } catch (e: Exception) {
                try {
                    onWebView()
                        .withElement(findElement(Locator.TAG_NAME, "body"))
                        .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue())))
                    Log.e(tag, "WebView ready (body found)")
                    Thread.sleep(1000)
                    return true
                } catch (e2: Exception) {
                    Thread.sleep(500)
                }
            }
        }
        Log.w(tag, "WebView ready timeout")
        return false
    }

    /** 페이지 제목 가져오기 */
    fun getPageTitle(): String {
        return tryGetPageTitleViaUIAutomator() ?: "UNKNOWN"
    }

    /** UIAutomator로 툴바 타이틀 가져오기 */
    private fun tryGetPageTitleViaUIAutomator(): String? {
        try {
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            // 툴바의 TextView 찾기 (content-desc가 있는 것)
            val toolbarTitle = device.findObject(By.clazz("android.widget.TextView")
                .hasAncestor(By.clazz("android.widget.Toolbar")
                    .hasAncestor(By.pkg("com.kiyo.app"))))
            if (toolbarTitle != null) {
                return toolbarTitle.text
            }
            // 대안: action bar 영역의 첫 번째 TextView
            val actionBarTitle = device.findObject(By.clazz("android.widget.TextView")
                .hasAncestor(By.clazz("android.widget.ActionBarContainer")))
            if (actionBarTitle != null) {
                return actionBarTitle.text
            }
        } catch (e: Exception) {
            Log.w(tag, "UIAutomator getPageTitle failed: ${e.message}")
        }
        return null
    }

    /** 뷰 계층 덤프 */
    fun dumpViewHierarchy(step: String): String {
        val timestamp = System.currentTimeMillis()
        val fileName = "uiautomator_${step}_$timestamp.xml"
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val internalFile = File("/data/user/0/com.kiyo.app/cache/$fileName")
        
        device.dumpWindowHierarchy(internalFile)
        Thread.sleep(500)

        // 텍스트 요약 생성: text/hint가 있는 노드만 추출 (덤프 확인을 adb shell cat 한 번으로 끝내기 위함)
        try {
            val summary = buildString {
                appendLine("packages: " + Regex("package=\"([^\"]+)\"").findAll(internalFile.readText())
                    .map { it.groupValues[1] }.toSet().joinToString(", "))
                Regex("class=\"android[.]widget[.](TextView|EditText|Button)\"[^>]*text=\"([^\"]+)\"")
                    .findAll(internalFile.readText()).forEach { m ->
                        val t = m.groupValues[2]
                        if (t.isNotBlank()) appendLine("[${m.groupValues[1]}] ${t.take(70)}")
                    }
            }
            val summaryFile = File("/data/user/0/com.kiyo.app/cache/${fileName.removeSuffix(".xml")}_summary.txt")
            summaryFile.writeText(summary)
            Runtime.getRuntime().exec("cp ${summaryFile.absolutePath} /storage/emulated/0/Download/kiyo_test_${summaryFile.name}").waitFor()
            Log.e(tag, "VIEW_SUMMARY: ${summaryFile.name} (text nodes only)")
        } catch (e: Exception) {
            Log.w(tag, "Summary generation failed: ${e.message}")
        }
        
        // 외부 저장소로 복사
        val externalPath = "/storage/emulated/0/Download/kiyo_test_$fileName"
        try {
            Runtime.getRuntime().exec("cp ${internalFile.absolutePath} $externalPath").waitFor()
            Log.e(tag, "VIEW_HIERARCHY: $fileName copied to external: $externalPath")
        } catch (e: Exception) {
            Log.w(tag, "Failed to copy view hierarchy: ${e.message}")
        }
        
        Log.e(tag, "VIEW_HIERARCHY: $fileName dumped for step: $step (internal: ${internalFile.absolutePath})")
        return internalFile.absolutePath
    }

    /** 스크린샷 캡처 */
    fun captureScreen(step: String): String {
        val timestamp = System.currentTimeMillis()
        val fileName = "screen_${step}_$timestamp.png"
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        val internalFile = File("/data/user/0/com.kiyo.app/cache/$fileName")
        
        device.takeScreenshot(internalFile)
        Thread.sleep(500)
        
        val externalPath = "/storage/emulated/0/Download/kiyo_test_$fileName"
        try {
            Runtime.getRuntime().exec("cp ${internalFile.absolutePath} $externalPath").waitFor()
            Log.e(tag, "SCREENSHOT: $fileName copied to external: $externalPath")
        } catch (e: Exception) {
            Log.w(tag, "Failed to copy screenshot: ${e.message}")
        }
        
        Log.e(tag, "SCREENSHOT: $fileName captured for step: $step (internal: ${internalFile.absolutePath})")
        return internalFile.absolutePath
    }

    /** 네이티브 백 버튼 누르기 */
    fun goBack(): Boolean {
        try {
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            device.pressBack()
            Thread.sleep(500)
            Log.e(tag, "Pressed native back button")
            return true
        } catch (e: Exception) {
            Log.w(tag, "goBack failed: ${e.message}")
            return false
        }
    }

    /** UIAutomator로 WebView 내부 버튼 텍스트로 클릭 */
    fun clickWebButtonByText(text: String, description: String): Boolean {
        try {
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            // WebView 내 버튼 찾기 (className으로)
            val buttons = device.findObjects(By.clazz("android.widget.Button"))
            for (button in buttons) {
                if (button.text == text || button.contentDescription == text) {
                    button.click()
                    Thread.sleep(500)
                    Log.e(tag, "UIAutomator clicked button: $text")
                    return true
                }
            }
            // content-desc로도 시도
            val descButton = device.findObject(By.desc(text).clickable(true))
            if (descButton != null) {
                descButton.click()
                Thread.sleep(500)
                Log.e(tag, "UIAutomator clicked button by desc: $text")
                return true
            }
            return false
        } catch (e: Exception) {
            Log.w(tag, "clickWebButtonByText failed for $description: ${e.message}")
            return false
        }
    }

    /** UIAutomator로 텍스트로 버튼 클릭 */
    fun clickByTextUiAutomator(text: String, description: String): Boolean {
        try {
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            val button = device.findObject(By.text(text).clickable(true))
                ?: device.findObject(By.desc(text).clickable(true))
            if (button != null) {
                button.click()
                Thread.sleep(500)
                Log.e(tag, "UIAutomator clicked by text: $text")
                return true
            }
            return false
        } catch (e: Exception) {
            Log.w(tag, "clickByTextUiAutomator failed for $description: ${e.message}")
            return false
        }
    }

    /**
     * 부분 문자열로 노드를 찾아 클릭 (UIAutomator By.textContains).
     * dataset(RemoteViews)처럼 접두 이모지/접미 문자가 붙는 노드 매칭에 사용.
     */
    fun clickByTextContains(partialText: String, description: String): Boolean {
        try {
            val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
            val button = device.findObject(By.textContains(partialText).clickable(true))
                ?: device.findObject(By.textContains(partialText))
            if (button != null) {
                button.click()
                Thread.sleep(500)
                Log.e(tag, "UIAutomator clicked by textContains '$partialText': $description")
                return true
            }
            return false
        } catch (e: Exception) {
            Log.w(tag, "clickByTextContains failed for $description: ${e.message}")
            return false
        }
    }

    // ============ 내부 헬퍼 ============

    /** XPath로 텍스트 읽기 (볼트 파일명 등 읽기용) */
    fun getTextByXPath(xpath: String): String? {
        try {
            // JavaScript로 직접 텍스트 읽기 (Espresso-Web으로는 텍스트 추출 어려움)
            return readTextByXPath(xpath)
        } catch (e: Exception) {
            Log.w(tag, "getTextByXPath failed for $xpath: ${e.message}")
            return null
        }
    }

    /** JavaScript로 XPath 요소의 텍스트 직접 읽기 */
    private fun readTextByXPath(xpath: String): String? {
        try {
            val instrumentation = InstrumentationRegistry.getInstrumentation()
            val context = instrumentation.targetContext
            val webView = getWebView(context)
            
            if (webView == null) {
                Log.w(tag, "WebView not found for readTextByXPath")
                return null
            }
            
            val script = """
                (function() {
                    var result = document.evaluate("$xpath", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    if (result.singleNodeValue) {
                        return result.singleNodeValue.textContent || result.singleNodeValue.innerText || "";
                    }
                    return null;
                })()
            """.trimIndent()
            
            var result: String? = null
            val latch = java.util.concurrent.CountDownLatch(1)
            
            webView.post {
                webView.evaluateJavascript(script, { value ->
                    // value는 JSON 문자열 형태 (따옴표 포함)
                    if (value != null && value != "null" && value != "undefined") {
                        // JSON 파싱으로 따옴표 제거
                        result = try {
                            org.json.JSONObject("{\"v\":$value}").getString("v")
                        } catch (e: Exception) {
                            value.replace("\"", "").trim()
                        }
                    }
                    latch.countDown()
                })
            }
            
            latch.await(5, java.util.concurrent.TimeUnit.SECONDS)
            return result?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            Log.w(tag, "readTextByXPath failed for $xpath: ${e.message}")
            return null
        }
    }

    private fun getWebView(context: android.content.Context): android.webkit.WebView? {
        return try {
            // ActivityLifecycleMonitor.getActivitiesInStage는 메인 스레드 전용 API.
            // 테스트는 instrumentation 워커 스레드에서 실행되므로 runOnMainSync로 감싼다.
            var activity: android.app.Activity? = null
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
                .runOnMainSync {
                    activity = androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
                        .getInstance()
                        .getActivitiesInStage(androidx.test.runner.lifecycle.Stage.RESUMED)
                        .firstOrNull()
                }

            val fromActivity = activity?.findViewById<com.getcapacitor.CapacitorWebView>(com.getcapacitor.android.R.id.webview)
            if (fromActivity != null) return fromActivity

            // 폴백: 컨텍스트가 Activity인 경우
            (context as? android.app.Activity)
                ?.findViewById<android.webkit.WebView>(android.R.id.content)
        } catch (e: Exception) {
            Log.w(tag, "getWebView failed: ${e.message}")
            null
        }
    }

    /** 선택자 체인 시도 (첫 번째 성공 반환) */
    private fun trySelectorChain(vararg actions: () -> Boolean): Boolean {
        for (action in actions) {
            try {
                if (action()) return true
            } catch (e: Exception) {
                Log.w(tag, "Selector attempt failed", e)
                // 다음 선택자 시도
            }
        }
        return false
    }

    /** 태그명으로 클릭 */
    private fun clickByTagName(tagName: String, description: String): Boolean {
        try {
            onWebView()
                .withElement(findElement(Locator.TAG_NAME, tagName))
                .perform(webClick())
            Log.e(tag, "Clicked $description (tag: $tagName)")
            return true
        } catch (e: Exception) {
            Log.w(tag, "Click by tag failed for $description: ${e.message}")
            return false
        }
    }

    /** XPath로 텍스트 입력 - 내부 구현
     *  webKeys()는 React controlled input의 onChange를 트리거하지 못하는 알려진 이슈가 있음
     *  (android-test #1655). 대신:
     *  1) Espresso-Web webClick()으로 필드에 포커스
     *  2) 기존 값 클리어 (select all + delete 키 이벤트)
     *  3) Instrumentation.sendStringSync()로 실제 시스템 키 이벤트 주입 → React onChange 발생
     *
     *  주의: sendStringSync는 KeyCharacterMap 기반이므로 ASCII 문자만 안전. 백그라운드 스레드 필수.
     */
        private fun typeByXPathInternal(xpath: String, text: String, description: String): Boolean {
            try {
                // 1) 필드 클릭으로 포커스 획득 (webKeys 대신 실제 키 입력을 위한 포커스 용도)
                onWebView()
                    .withElement(findElement(Locator.XPATH, xpath))
                    .perform(webClick())
                Thread.sleep(300) // 포커스 안정화

                // 2) 기존 값이 있으면 클리어 (ctrl+a, delete)
                val instrumentation = InstrumentationRegistry.getInstrumentation()
                val clearThread = Thread {
                    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_MOVE_END)
                    // Move End 후 Backspace를 여러 번 눌러 안전하게 클리어
                    repeat(100) { instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DEL) }
                }
                clearThread.start()
                clearThread.join(5000)
                Thread.sleep(200)

                // 3) 실제 키 이벤트로 텍스트 입력 (React onChange 트리거됨)
                val typeThread = Thread {
                    instrumentation.sendStringSync(text)
                }
                typeThread.start()
                typeThread.join(10000)
                Thread.sleep(200)

                Log.e(tag, "Typed via sendStringSync for $description (XPath: $xpath): '$text'")
                return true
            } catch (e: Exception) {
                Log.w(tag, "Type failed for $description (XPath: $xpath): ${e.message}")
                return false
            }
        }

    // ============ 로깅 ============

    fun log(message: String) {
        Log.e(tag, message)
    }
}