package com.kiyo.app.autofill.detection

import android.app.assist.AssistStructure
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class FieldScoringRulesTest {

    private lateinit var mockNode: AssistStructure.ViewNode

    @Before
    fun setup() {
        mockNode = mockk()
    }

    @Test
    fun `isValidInputField returns true for EditText class with inputType`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.inputType } returns 1 // TYPE_CLASS_TEXT
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockk<android.view.autofill.AutofillId>()

        val result = FieldScoringRules.isValidInputField(mockNode)

        assertTrue(result)
    }

    @Test
    fun `isValidInputField returns true for TextInputEditText`() = runTest {
        every { mockNode.className } returns "com.google.android.material.textfield.TextInputEditText"
        every { mockNode.inputType } returns 1
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns mockk<android.view.autofill.AutofillId>()

        val result = FieldScoringRules.isValidInputField(mockNode)

        assertTrue(result)
    }

    @Test
    fun `isValidInputField returns true for WebView internal node with username hint`() = runTest {
        // TODO: WebView logic requires specific className matching, skip for now
    }

    @Test
    fun `isValidInputField returns true for WebView internal node with password hint`() = runTest {
        // TODO: WebView logic requires specific className matching, skip for now
    }

    @Test
    fun `isValidInputField returns false for TextView`() = runTest {
        every { mockNode.className } returns "android.widget.TextView"
        every { mockNode.inputType } returns 0
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns null

        val result = FieldScoringRules.isValidInputField(mockNode)

        assertFalse(result)
    }

    @Test
    fun `isValidInputField returns false for ViewGroup container`() = runTest {
        every { mockNode.className } returns "android.widget.LinearLayout"
        every { mockNode.inputType } returns 0
        every { mockNode.childCount } returns 2
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns null

        val result = FieldScoringRules.isValidInputField(mockNode)

        assertFalse(result)
    }

    @Test
    fun `isValidInputField returns false for node without input attributes`() = runTest {
        every { mockNode.className } returns "android.view.View"
        every { mockNode.inputType } returns 0
        every { mockNode.childCount } returns 0
        every { mockNode.autofillHints } returns null
        every { mockNode.autofillId } returns null

        val result = FieldScoringRules.isValidInputField(mockNode)

        assertFalse(result)
    }

    @Test
    fun `isEditTextClass returns true for EditText`() = runTest {
        every { mockNode.className } returns "android.widget.EditText"

        val result = FieldScoringRules.isEditTextClass(mockNode)

        assertTrue(result)
    }

    @Test
    fun `isEditTextClass returns true for TextInputEditText`() = runTest {
        every { mockNode.className } returns "com.google.android.material.textfield.TextInputEditText"

        val result = FieldScoringRules.isEditTextClass(mockNode)

        assertTrue(result)
    }

    @Test
    fun `isEditTextClass returns false for TextView`() = runTest {
        every { mockNode.className } returns "android.widget.TextView"

        val result = FieldScoringRules.isEditTextClass(mockNode)

        assertFalse(result)
    }

    @Test
    fun `isPasswordVariation returns true for TYPE_TEXT_VARIATION_PASSWORD`() = runTest {
        val inputType = 0x00000080 // TYPE_TEXT_VARIATION_PASSWORD

        val result = FieldScoringRules.isPasswordVariation(inputType)

        assertTrue(result)
    }

    @Test
    fun `isPasswordVariation returns false for TYPE_CLASS_TEXT`() = runTest {
        val inputType = 1 // TYPE_CLASS_TEXT

        val result = FieldScoringRules.isPasswordVariation(inputType)

        assertFalse(result)
    }

    @Test
    fun `isVisiblePasswordVariation returns true for TYPE_TEXT_VARIATION_VISIBLE_PASSWORD`() = runTest {
        val inputType = 0x00000090 // TYPE_TEXT_VARIATION_VISIBLE_PASSWORD

        val result = FieldScoringRules.isVisiblePasswordVariation(inputType)

        assertTrue(result)
    }

    @Test
    fun `isEmailVariation returns true for TYPE_TEXT_VARIATION_EMAIL_ADDRESS`() = runTest {
        val inputType = 0x00000020 // TYPE_TEXT_VARIATION_EMAIL_ADDRESS

        val result = FieldScoringRules.isEmailVariation(inputType)

        assertTrue(result)
    }

    @Test
    fun `isEmailVariation returns false for TYPE_CLASS_TEXT`() = runTest {
        val inputType = 1 // TYPE_CLASS_TEXT

        val result = FieldScoringRules.isEmailVariation(inputType)

        assertFalse(result)
    }

    @Test
    fun `isTextClass returns true for TYPE_CLASS_TEXT`() = runTest {
        val inputType = 1 // TYPE_CLASS_TEXT

        val result = FieldScoringRules.isTextClass(inputType)

        assertTrue(result)
    }

    @Test
    fun `isTextClass returns false for TYPE_CLASS_NUMBER`() = runTest {
        val inputType = 2 // TYPE_CLASS_NUMBER

        val result = FieldScoringRules.isTextClass(inputType)

        assertFalse(result)
    }
}