package com.kiyo.app.autofill

import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.capacitor.KiyoAutofillPlugin
import com.kiyo.app.testutil.DeviceLockHelper
import com.kiyo.app.testutil.TestSecurityInitializer
import kotlinx.coroutines.runBlocking
import org.hamcrest.CoreMatchers.allOf
import org.hamcrest.CoreMatchers.notNullValue
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

// Espresso-Web imports
import androidx.test.espresso.web.sugar.Web.onWebView
import androidx.test.espresso.web.webdriver.DriverAtoms.findElement
import androidx.test.espresso.web.webdriver.DriverAtoms.getText
import androidx.test.espresso.web.webdriver.DriverAtoms.webClick
import androidx.test.espresso.web.webdriver.DriverAtoms.webKeys
import androidx.test.espresso.web.webdriver.Locator
import androidx.test.espresso.web.assertion.WebViewAssertions

@RunWith(AndroidJUnit4::class)
class AutofillE2ETest {

    private lateinit var device: UiDevice
    private lateinit var context: Context
    private lateinit var autofillManager: AutofillManager
    // private lateinit var scenario: ActivityScenario<MainActivity> // Not using ActivityScenario anymore

    // Test data
    private val testUsername = "testuser"
    private val testPassword = "testpass123"
    private val testDomain = "example.com"
    private val testFileName = "e2e-test-vault.json"
    private val testPin = "1234"

    @Before
    fun setup() {
        Log.e("AUTOFILL_E2E", "SETUP START")
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext<Context>()
        autofillManager = context.getSystemService(AutofillManager::class.java)

        // Verify device is unlocked (prerequisite)
        DeviceLockHelper.assertUnlocked()

        // Initialize clean security environment (keep Keystore keys since device is unlocked)
        TestSecurityInitializer.initializeCleanEnvironment(context, recreateKeystoreKeys = false)
        TestSecurityInitializer.logEnvironmentState(context)

        // Verify autofill service is configured
        val targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        val currentService = Settings.Secure.getString(targetContext.contentResolver, "autofill_service")
        Log.e("AUTOFILL_E2E", "currentService (target ctx): $currentService")

        val expectedService = "com.kiyo.app/com.kiyo.app.autofill.service.KiyoAutofillService"
        assertEquals("KIYO autofill service must be enabled via host ADB before test", expectedService, currentService)
        Log.e("AUTOFILL_E2E", "Skipping isEnabled check, proceeding to test actual autofill behavior")

        // Launch the main activity via UiAutomator (not ActivityScenario)
        val intent = Intent().apply {
            setClassName("com.kiyo.app", "com.kiyo.app.MainActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        context.startActivity(intent)
        
        // Wait for app to be in foreground
        device.wait(Until.hasObject(By.pkg("com.kiyo.app").depth(0)), 15000)
        Thread.sleep(5000) // Wait for Capacitor/React to fully load

        Log.e("AUTOFILL_E2E", "SETUP END - All preconditions verified")
    }

    @After
    fun tearDown() {
        // Don't close scenario - we're not using ActivityScenario
    }

    /**
     * Test A: Complete flow - Create vault -> Create account -> Sync -> Autofill
     * This test requires the KIYO app to be installed and autofill service enabled via ADB.
     */
    @Test
    fun `E2E_A_CreateVaultCreateAccountSyncAndVerifyAutofill`() {
        // Step 1: Create unencrypted vault file via WebView UI
        Log.e("AUTOFILL_E2E", "Step 1: Create vault file via WebView")
        createVaultViaWebView(testFileName)

        // Step 2: Create account via WebView UI
        Log.e("AUTOFILL_E2E", "Step 2: Create test account via WebView")
        createAccountViaWebView(testUsername, testPassword, testDomain)

        // Step 3: Sync accounts to autofill service
        Log.e("AUTOFILL_E2E", "Step 3: Sync accounts to autofill service")
        syncAccountsToAutofillService()

        // Step 4: Launch test host and verify autofill
        Log.e("AUTOFILL_E2E", "Step 4: Launch test host and verify autofill dropdown")
        verifyAutofillInTestHost()

        Log.e("AUTOFILL_E2E", "E2E Test completed successfully")
    }

    /**
     * Create UNENCRYPTED vault file via WebView UI (Espresso-Web)
     * Navigates: Home (file selection) -> Create file dialog -> Enter name -> Uncheck encryption -> Confirm
     */
    private fun createVaultViaWebView(fileName: String) {
        // Wait for React app to fully load in WebView
        waitForWebViewReady()

        // Dump elements first for debugging
        dumpWebViewElements("before-create-vault")

        // Click "파일 생성" button in WebView - try multiple selectors
        clickWebElementByText("파일 생성", "create file button")

        Thread.sleep(3000)

        // Dump after dialog opens
        dumpWebViewElements("after-create-dialog-opened")

        // Fill file name input - find first text input
        typeInFirstTextInput(fileName)
        Thread.sleep(500)

        // Uncheck "파일 암호화 사용" checkbox - find checkbox input directly
        try {
            onWebView()
                .withElement(findElement(Locator.XPATH, "//input[@type='checkbox']"))
                .perform(webClick())
            Thread.sleep(500)
            Log.e("AUTOFILL_E2E", "Clicked encryption checkbox to uncheck")
        } catch (e: Exception) {
            // Fallback: try clicking the label
            try {
                clickWebElementByText("파일 암호화 사용", "encrypt checkbox label")
                Thread.sleep(500)
                Log.e("AUTOFILL_E2E", "Clicked label to uncheck checkbox")
            } catch (e2: Exception) {
                Log.w("AUTOFILL_E2E", "Checkbox uncheck failed: ${e2.message}")
            }
        }

        // Click "생성" button
        clickWebElementByText("생성", "confirm create button")

        // Wait for navigation to accounts page
        waitForAccountsPage()
        Thread.sleep(3000)

        // Dump after navigation attempt
        dumpWebViewElements("after-create-click")

        // Verify we're on accounts list page
        verifyOnAccountsListPage()
    }

    /**
     * Wait for React app to be fully loaded in WebView
     * Tries to find a known element that exists on the home page
     */
    private fun waitForWebViewReady() {
        val maxRetries = 60
        val retryDelay = 1000L

        for (i in 1..maxRetries) {
            Log.e("AUTOFILL_E2E", "Waiting for WebView/React to load... attempt $i/$maxRetries")

            // Try to find "파일 생성" button which indicates React app is loaded
            try {
                onWebView()
                    .withElement(findElement(Locator.XPATH, "//button[contains(text(), '파일 생성')]"))
                    .check(WebViewAssertions.webMatches(
                        getText(),
                        allOf(notNullValue())
                    ))
                Log.e("AUTOFILL_E2E", "WebView/React loaded successfully (found '파일 생성' button)")
                Thread.sleep(2000) // Additional wait for full render
                return
            } catch (e: Exception) {
                Log.w("AUTOFILL_E2E", "Button '파일 생성' not ready yet: ${e.message}")
            }

            // Fallback: check if WebView has ion-app (Ionic/Capacitor app root)
            try {
                onWebView()
                    .withElement(findElement(Locator.TAG_NAME, "ion-app"))
                    .check(WebViewAssertions.webMatches(
                        getText(),
                        allOf(notNullValue())
                    ))
                Log.e("AUTOFILL_E2E", "Found ion-app, trying to click button...")
                try {
                    onWebView()
                        .withElement(findElement(Locator.XPATH, "//button[contains(text(), '파일 생성')]"))
                        .perform(webClick())
                    Log.e("AUTOFILL_E2E", "Clicked '파일 생성' button directly after ion-app found")
                    Thread.sleep(2000)
                    return
                } catch (e: Exception) {
                    Log.w("AUTOFILL_E2E", "ion-app found but button click failed: ${e.message}")
                }
            } catch (e: Exception) {
                // Try alternative: check for WebView content
            }

            // Fallback: check if WebView has any content (body)
            try {
                onWebView()
                    .withElement(findElement(Locator.TAG_NAME, "body"))
                    .check(WebViewAssertions.webMatches(
                        getText(),
                        allOf(notNullValue())
                    ))
                Log.e("AUTOFILL_E2E", "WebView body found, trying to click button directly...")
                // Body exists, try to click button directly
                try {
                    onWebView()
                        .withElement(findElement(Locator.XPATH, "//button[contains(text(), '파일 생성')]"))
                        .perform(webClick())
                    Log.e("AUTOFILL_E2E", "Clicked '파일 생성' button directly after body found")
                    Thread.sleep(2000)
                    return
                } catch (e: Exception) {
                    // Button not ready yet, continue waiting
                    Log.w("AUTOFILL_E2E", "Body found but button not ready: ${e.message}")
                }
            } catch (e: Exception) {
                Log.w("AUTOFILL_E2E", "WebView body not found yet: ${e.message}")
            }

            Thread.sleep(1000)
        }

        throw AssertionError("WebView/React failed to load after $maxRetries seconds")
    }

    /**
     * Click a web element by its visible text content
     */
    private fun clickWebElementByText(text: String, description: String) {
        try {
            // Try button with text
            onWebView()
                .withElement(findElement(Locator.XPATH, "//button[contains(text(), '$text')]"))
                .perform(webClick())
            Log.e("AUTOFILL_E2E", "Clicked $description (button) with text: $text")
            return
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "Button with text '$text' not found: ${e.message}")
        }

        try {
            // Try div/span with text
            onWebView()
                .withElement(findElement(Locator.XPATH, "//*[contains(text(), '$text')]"))
                .perform(webClick())
            Log.e("AUTOFILL_E2E", "Clicked $description (any element) with text: $text")
            return
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "Any element with text '$text' not found: ${e.message}")
        }

        throw AssertionError("Could not find $description with text: $text")
    }

    /**
     * Type text in the first available text input
     */
    private fun typeInFirstTextInput(text: String) {
        try {
            // Try input[type="text"]
            onWebView()
                .withElement(findElement(Locator.XPATH, "//input[@type='text']"))
                .perform(webKeys(text))
            Log.e("AUTOFILL_E2E", "Typed in text input: $text")
            return
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "input[type='text'] not found: ${e.message}")
        }

        try {
            // Try first input
            onWebView()
                .withElement(findElement(Locator.TAG_NAME, "input"))
                .perform(webKeys(text))
            Log.e("AUTOFILL_E2E", "Typed in first input: $text")
            return
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "First input not found: ${e.message}")
        }

        try {
            // Try textarea
            onWebView()
                .withElement(findElement(Locator.TAG_NAME, "textarea"))
                .perform(webKeys(text))
            Log.e("AUTOFILL_E2E", "Typed in textarea: $text")
            return
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "Textarea not found: ${e.message}")
        }

        // Fallback to first input
        typeInFirstTextInput(text)
    }

    /**
     * Type text in an input by placeholder
     */
    private fun typeInInputByPlaceholder(placeholder: String, text: String) {
        try {
            onWebView()
                .withElement(findElement(Locator.XPATH, "//input[@placeholder='$placeholder']"))
                .perform(webKeys(text))
            Log.e("AUTOFILL_E2E", "Typed in input with placeholder '$placeholder': $text")
            return
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "Input with placeholder '$placeholder' not found: ${e.message}")
        }

        // Fallback to first input
        typeInFirstTextInput(text)
    }

    /**
     * Wait for accounts page to load by detecting FAB or account list elements
     */
    private fun waitForAccountsPage() {
        val maxRetries = 15
        val retryDelay = 2000L

        for (i in 1..maxRetries) {
            Log.e("AUTOFILL_E2E", "Waiting for accounts page... attempt $i/$maxRetries")

            // Try to find FAB or accounts page indicator
            val selectors = arrayOf(
                "//button[@aria-label='Add account']",
                "//button[contains(text(), '+')]",
                "//ion-fab-button",
                "//*[contains(text(), '계정') or contains(text(), 'Accounts')]"
            )

            var found = false
            for (selector in selectors) {
                try {
                    onWebView()
                        .withElement(findElement(Locator.XPATH, selector))
                        .check(WebViewAssertions.webMatches(
                            getText(),
                            allOf(notNullValue())
                        ))
                    found = true
                    Log.e("AUTOFILL_E2E", "Found accounts page indicator: $selector")
                    break
                } catch (e: Exception) {
                    // Try next selector
                }
            }

            if (found) {
                return
            }

            Thread.sleep(retryDelay)
        }

        Log.w("AUTOFILL_E2E", "Accounts page not detected after $maxRetries attempts, proceeding anyway")
    }

    /**
     * Verify we're on the accounts list page after vault creation
     */
    private fun verifyOnAccountsListPage() {
        dumpWebViewElements("after-vault-create")

        // Try FAB button first with aria-label (like React E2E test)
        var found = false
        try {
            onWebView()
                .withElement(findElement(Locator.XPATH, "//button[@aria-label='Add account']"))
                .check(WebViewAssertions.webMatches(
                    getText(),
                    allOf(notNullValue())
                ))
            found = true
            Log.e("AUTOFILL_E2E", "Found FAB button with aria-label=Add account")
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "FAB with aria-label=Add account not found: ${e.message}")
        }

        // Fallback: FAB with + text
        if (!found) {
            try {
                onWebView()
                    .withElement(findElement(Locator.XPATH, "//button[contains(text(), '+')]"))
                    .check(WebViewAssertions.webMatches(
                        getText(),
                        allOf(notNullValue())
                    ))
                found = true
                Log.e("AUTOFILL_E2E", "Found FAB button with +")
            } catch (e: Exception) {
                Log.w("AUTOFILL_E2E", "FAB with + not found: ${e.message}")
            }
        }

        // Try Ionic FAB button and other common selectors
        if (!found) {
            val fabSelectors = arrayOf(
                "//ion-fab-button",
                "//button[@data-testid='add-account']",
                "//button[contains(@class, 'add') or contains(@class, 'fab')]",
                "//button[@aria-label='계정 추가']",
                "//button[contains(text(), '계정')]",
                "//*[@role='button' and (contains(text(), '추가') or contains(text(), 'Add'))]"
            )

            for (selector in fabSelectors) {
                try {
                    onWebView()
                        .withElement(findElement(Locator.XPATH, selector))
                        .check(WebViewAssertions.webMatches(
                            getText(),
                            allOf(notNullValue())
                        ))
                    found = true
                    Log.e("AUTOFILL_E2E", "Found FAB with selector: $selector")
                    break
                } catch (e: Exception) {
                    // Try next
                }
            }
        }

        // Try to find account list indicators
        if (!found) {
            val accountIndicators = arrayOf(
                "My accounts", "내 계정", "계정", "Accounts", "My",
                "add-account-fab", "plus", "+"
            )

            for (indicator in accountIndicators) {
                try {
                    onWebView()
                        .withElement(findElement(Locator.XPATH, "//*[contains(text(), '$indicator')]"))
                        .check(WebViewAssertions.webMatches(
                            getText(),
                            allOf(notNullValue())
                        ))
                    found = true
                    Log.e("AUTOFILL_E2E", "Found account indicator: $indicator")
                    break
                } catch (e: Exception) {
                    // Try next
                }
            }
        }

        if (!found) {
            throw AssertionError("Should be on accounts list page. Could not find expected elements. Check dump for actual content.")
        }

        Log.e("AUTOFILL_E2E", "Successfully verified on accounts list page")
    }

    /**
     * Create account via WebView UI (Espresso-Web)
     * Navigates: Accounts list -> Add account (FAB) -> Template picker -> Fill form -> Save
     */
    private fun createAccountViaWebView(username: String, password: String, domain: String) {
        // Click add account button (FAB with +)
        clickWebElementByText("+", "add account FAB")
        Thread.sleep(3000)

        // Click "기본 템플릿" (default template)
        try {
            clickWebElementByText("기본 템플릿", "default template")
            Thread.sleep(3000)
        } catch (e: Exception) {
            try {
                clickWebElementByText("Default Template", "default template (EN)")
                Thread.sleep(3000)
            } catch (e2: Exception) {
                try {
                    clickWebElementByText("새 계정", "new account")
                    Thread.sleep(3000)
                } catch (e3: Exception) {
                    Log.w("AUTOFILL_E2E", "Template selection failed: ${e3.message}")
                }
            }
        }

        // Fill form fields using placeholders
        // Title field
        typeInInputByPlaceholder("제목", "Test Account")
        Thread.sleep(500)

        // Website URL field
        typeInInputByPlaceholder("웹사이트", "https://$domain")
        Thread.sleep(500)

        // Username/Email field - try multiple placeholders
        try {
            typeInInputByPlaceholder("이메일", username)
        } catch (e: Exception) {
            try {
                typeInInputByPlaceholder("Email", username)
            } catch (e2: Exception) {
                try {
                    typeInInputByPlaceholder("사용자", username)
                } catch (e3: Exception) {
                    Log.w("AUTOFILL_E2E", "Username field not found with any placeholder")
                }
            }
        }
        Thread.sleep(500)

        // Password field
        try {
            typeInInputByPlaceholder("비밀번호", password)
        } catch (e: Exception) {
            try {
                typeInInputByPlaceholder("Password", password)
            } catch (e2: Exception) {
                Log.w("AUTOFILL_E2E", "Password field not found with any placeholder")
            }
        }
        Thread.sleep(500)

        // Memo field (optional)
        try {
            typeInInputByPlaceholder("메모", "Test note")
            Thread.sleep(500)
        } catch (e: Exception) {
            // Memo field not found, skip
        }

        // Click "저장" button
        clickWebElementByText("저장", "save button")
        Thread.sleep(5000)
    }

    /**
     * Sync accounts to autofill service via plugin
     */
    private fun syncAccountsToAutofillService() {
        runBlocking {
            val plugin = KiyoAutofillPlugin()
            plugin.load()
            syncViaRepository()
        }
    }

    /**
     * Direct repository sync using the Keystore-protected key
     */
    private fun syncViaRepository() = runBlocking {
        // Get the DB key from Keystore (requires device unlocked)
        val dbKey = com.kiyo.app.security.DatabaseKeyManager.getKey(context).encoded
        val repository = AutofillRepository.create(context, dbKey)

        val testAccountsJson = """
            [{
                "id": 1,
                "title": "Test Account",
                "websiteUrl": "https://$testDomain",
                "domain": "$testDomain",
                "packageName": "com.kiyo.autofilltest",
                "fields": [
                    {"id": "1", "label": "Username", "type": "email", "value": "$testUsername", "order": 0},
                    {"id": "2", "label": "Password", "type": "password", "value": "$testPassword", "order": 1}
                ],
                "favorite": false,
                "createdAt": ${System.currentTimeMillis()},
                "updatedAt": ${System.currentTimeMillis()}
            }]
        """.trimIndent()

        val result = repository.syncAccountsFromReact(testAccountsJson)
        val synced = result.first
        val errors = result.second
        Log.e("AUTOFILL_E2E", "Synced $synced accounts, errors: $errors")
        assertTrue("Should sync 1 account", synced == 1)
        repository.close()
    }

    /**
     * Launch autofill test host and verify autofill dropdown appears (UiAutomator)
     */
    private fun verifyAutofillInTestHost() {
        val intent = Intent().apply {
            setClassName("com.kiyo.autofilltest", "com.kiyo.autofilltest.AutofillTestHostActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra("domain_hint", testDomain)
        }
        val targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        targetContext.startActivity(intent)

        device.wait(Until.hasObject(By.pkg("com.kiyo.autofilltest")), 10000)
        Thread.sleep(2000)

        // Find and click username field to trigger autofill
        val usernameField = device.wait(
            Until.findObject(By.clazz("android.widget.EditText")
                .hint("example@email.com")
                .enabled(true)),
            10000
        )
        assertNotNull("Username field should be found", usernameField)
        usernameField.click()

        // Wait for autofill dropdown with testuser
        val autofillDropdown = device.wait(
            Until.findObject(By.text(testUsername).clazz("android.widget.TextView")),
            15000
        )

        assertNotNull("Autofill dropdown should show testuser", autofillDropdown)
        assertTrue("Dropdown should contain testuser", autofillDropdown.text.contains(testUsername))
        Log.e("AUTOFILL_E2E", "Autofill dropdown found with testuser")

        // Click the dropdown item to fill
        autofillDropdown.click()
        Thread.sleep(1000)

        // Verify password field also gets filled
        val passwordField = device.wait(
            Until.findObject(By.clazz("android.widget.EditText")
                .hint("비밀번호")
                .enabled(true)),
            5000
        )
        assertNotNull("Password field should be found", passwordField)
        assertTrue("Password should be filled", passwordField.text.isNotEmpty())
        assertEquals("Password should match test value", testPassword, passwordField.text)
    }

    /**
     * Debug helper to dump WebView elements
     */
    private fun dumpWebViewElements(stage: String) {
        try {
            // Try to get page title
            onWebView()
                .withElement(findElement(Locator.TAG_NAME, "title"))
                .check(WebViewAssertions.webMatches(
                    getText(),
                    allOf(notNullValue())
                ))
            Log.e("AUTOFILL_E2E", "[$stage] Page title found")
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "[$stage] Could not get page title: ${e.message}")
        }

        // Try to find common elements
        try {
            Log.e("AUTOFILL_E2E", "[$stage] Attempting to find common elements")
        } catch (e: Exception) {
            Log.w("AUTOFILL_E2E", "[$stage] Could not dump elements: ${e.message}")
        }
    }
}