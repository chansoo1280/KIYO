package com.kiyo.app.autofill.detection

import android.app.assist.AssistStructure
import android.util.Pair
import android.view.ViewStructure
import android.view.autofill.AutofillId
import com.kiyo.app.autofill.viewnode.HtmlAttributeExtractor
import com.kiyo.app.autofill.viewnode.ViewNodeExtractor
import com.kiyo.app.autofill.viewnode.ViewNodePredicate
import io.mockk.*
import io.mockk.impl.annotations.RelaxedMockK
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLog

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class FieldScorerTest {

    @RelaxedMockK
    private lateinit var mockNode: AssistStructure.ViewNode

    @RelaxedMockK
    private lateinit var mockAutofillId: AutofillId

    private lateinit var logOutput: java.io.ByteArrayOutputStream

    @Before
    fun setup() {
        MockKAnnotations.init(this)
        logOutput = java.io.ByteArrayOutputStream()
        ShadowLog.stream = java.io.PrintStream(logOutput)
    }

    @After
    fun tearDown() {
        unmockkAll()
    }

    // Helper: Mock HTML autocomplete attribute
    private fun mockHtmlAutocomplete(value: String) {
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns listOf(Pair("autocomplete", value))
        every { mockNode.htmlInfo } returns htmlInfo
    }

    // Helper: Mock HTML input type attribute
    private fun mockHtmlInputType(value: String) {
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns listOf(Pair("type", value))
        every { mockNode.htmlInfo } returns htmlInfo
    }

    // Helper: Capture and assert structured log format
    private fun assertStructuredLogContains(autofillId: String, type: String, expectedScore: Int) {
        val logs = logOutput.toString()
        assertTrue("Log should contain FieldCandidate entry: $logs", logs.contains("FieldCandidate"))
        assertTrue("Log should contain type=$type: $logs", logs.contains("type=$type"))
        assertTrue("Log should contain autofillId=$autofillId: $logs", logs.contains("autofillId=$autofillId"))
        assertTrue("Log should contain score=$expectedScore: $logs", logs.contains("score=$expectedScore"))
    }

    // Test 1: Username structured logging
    @Test
    fun `calculateUsernameScore logs structured candidate details`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 1
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns arrayOf("username")
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        every { mockNode.htmlInfo } returns null

        FieldScorer.calculateUsernameScore(mockNode)

        val autofillId = mockAutofillId.toString()
        val expectedScore = FieldScoringRules.SCORE_AUTOFILL_HINTS_USERNAME +
            FieldScoringRules.SCORE_INPUT_TYPE_TEXT_CLASS +
            FieldScoringRules.SCORE_EDITTEXT_FALLBACK
        assertStructuredLogContains(autofillId, "Username", expectedScore)
    }

    // Test 2: Password structured logging
    @Test
    fun `calculatePasswordScore logs structured candidate details`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 0x00000080 // TYPE_TEXT_VARIATION_PASSWORD
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns arrayOf("password")
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        every { mockNode.htmlInfo } returns null

        FieldScorer.calculatePasswordScore(mockNode)

        val autofillId = mockAutofillId.toString()
        val expectedScore = FieldScoringRules.SCORE_AUTOFILL_HINTS_PASSWORD +
            FieldScoringRules.SCORE_INPUT_TYPE_PASSWORD +
            FieldScoringRules.SCORE_EDITTEXT_PASSWORD_FALLBACK
        assertStructuredLogContains(autofillId, "Password", expectedScore)
    }

    // Test 3: Baseline - calculateUsernameScore returns candidate for autofillHints=username
    @Test
    fun `calculateUsernameScore returns candidate for autofillHints=username`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 1
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns arrayOf("username")
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        every { mockNode.htmlInfo } returns null

        val candidate = FieldScorer.calculateUsernameScore(mockNode)

        assertNotNull(candidate)
        assertTrue(candidate!!.score >= FieldScoringRules.SCORE_AUTOFILL_HINTS_USERNAME)
    }

    // Test 4: Baseline - calculateUsernameScore returns candidate for htmlAutocomplete=username
    @Test
    fun `calculateUsernameScore returns candidate for htmlAutocomplete=username`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 1
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        mockHtmlAutocomplete("username")

        val candidate = FieldScorer.calculateUsernameScore(mockNode)

        assertNotNull(candidate)
        assertTrue(candidate!!.score >= FieldScoringRules.SCORE_HTML_AUTOCOMPLETE_USERNAME)
    }

    // Test 5: Baseline - calculatePasswordScore returns candidate for autofillHints=password
    @Test
    fun `calculatePasswordScore returns candidate for autofillHints=password`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 0x00000080
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns arrayOf("password")
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        every { mockNode.htmlInfo } returns null

        val candidate = FieldScorer.calculatePasswordScore(mockNode)

        assertNotNull(candidate)
        assertTrue(candidate!!.score >= FieldScoringRules.SCORE_AUTOFILL_HINTS_PASSWORD)
    }

    // Test 6: Baseline - calculatePasswordScore returns candidate for htmlInputType=password
    @Test
    fun `calculatePasswordScore returns candidate for htmlInputType=password`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 0
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        mockHtmlInputType("password")

        val candidate = FieldScorer.calculatePasswordScore(mockNode)

        assertNotNull(candidate)
        assertTrue(candidate!!.score >= FieldScoringRules.SCORE_HTML_INPUT_TYPE_PASSWORD)
    }

    // Phase 7: aria-label matching tests
    @Test
    fun `calculateUsernameScore applies aria-label=아이디 bonus`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 1
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        // Mock aria-label with Korean "아이디"
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns listOf(Pair("aria-label", "아이디 또는 전화번호"))
        every { mockNode.htmlInfo } returns htmlInfo

        val candidate = FieldScorer.calculateUsernameScore(mockNode)

        assertNotNull(candidate)
        assertTrue(candidate!!.score >= 30) // aria-label bonus = 30
    }

    @Test
    fun `calculateUsernameScore applies aria-label=Username bonus`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 1
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        // Mock aria-label with English "Username"
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns listOf(Pair("aria-label", "Username"))
        every { mockNode.htmlInfo } returns htmlInfo

        val candidate = FieldScorer.calculateUsernameScore(mockNode)

        assertNotNull(candidate)
        assertTrue(candidate!!.score >= 30) // aria-label bonus = 30
    }

    @Test
    fun `calculatePasswordScore applies aria-label=비밀번호 bonus`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 0x00000080 // TYPE_TEXT_VARIATION_PASSWORD
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        // Mock aria-label with Korean "비밀번호"
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns listOf(Pair("aria-label", "비밀번호"))
        every { mockNode.htmlInfo } returns htmlInfo

        val candidate = FieldScorer.calculatePasswordScore(mockNode)

        assertNotNull(candidate)
        assertTrue(candidate!!.score >= 30) // aria-label bonus = 30
    }

    @Test
    fun `calculatePasswordScore applies name=pw match`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 0x00000080 // TYPE_TEXT_VARIATION_PASSWORD
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        // Mock name="pw" via htmlName
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns listOf(Pair("name", "pw"))
        every { mockNode.htmlInfo } returns htmlInfo

        val candidate = FieldScorer.calculatePasswordScore(mockNode)

        assertNotNull(candidate)
        // Should include name/id keyword match (30) + password inputType (100) + fallback (5) = 135
        assertTrue(candidate!!.score >= 135)
    }

    // Phase 7: threshold tests
    @Test
    fun `calculateUsernameScore returns null when score below threshold`() = runTest {
        // Set up a node with only fallback score (5pt) - should be filtered by threshold
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 1 // TYPE_CLASS_TEXT
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        every { mockNode.htmlInfo } returns null

        val candidate = FieldScorer.calculateUsernameScore(mockNode)

        assertNull("Score should be below threshold (5 < 20)", candidate)
    }

    @Test
    fun `calculatePasswordScore returns null when score below threshold`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 1 // TYPE_CLASS_TEXT (not password)
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockAutofillId
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
        every { mockNode.htmlInfo } returns null

        val candidate = FieldScorer.calculatePasswordScore(mockNode)

        assertNull("Score should be below threshold (no password signals)", candidate)
    }
}
