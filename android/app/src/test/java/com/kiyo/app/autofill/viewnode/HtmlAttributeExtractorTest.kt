package com.kiyo.app.autofill.viewnode

import android.app.assist.AssistStructure
import android.util.Pair
import android.view.ViewStructure
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class HtmlAttributeExtractorTest {

    private lateinit var mockNode: AssistStructure.ViewNode

    @Before
    fun setup() {
        mockNode = mockk()
    }

    @Test
    fun `getAriaLabel returns value for node with aria-label`() = runTest {
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns listOf(Pair("aria-label", "Username"))
        every { mockNode.htmlInfo } returns htmlInfo

        val result = HtmlAttributeExtractor.getAriaLabel(mockNode)

        assertEquals("Username", result)
    }

    @Test
    fun `getAriaLabel returns null for node without htmlInfo`() = runTest {
        every { mockNode.htmlInfo } returns null

        val result = HtmlAttributeExtractor.getAriaLabel(mockNode)

        assertNull(result)
    }

    @Test
    fun `getAriaLabel returns null for node with empty attributes`() = runTest {
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns emptyList()
        every { mockNode.htmlInfo } returns htmlInfo

        val result = HtmlAttributeExtractor.getAriaLabel(mockNode)

        assertNull(result)
    }

    @Test
    fun `getAriaLabel returns value for Korean label (이메일)`() = runTest {
        val htmlInfo = mockk<ViewStructure.HtmlInfo>()
        every { htmlInfo.attributes } returns listOf(Pair("aria-label", "이메일 또는 전화번호"))
        every { mockNode.htmlInfo } returns htmlInfo

        val result = HtmlAttributeExtractor.getAriaLabel(mockNode)

        assertEquals("이메일 또는 전화번호", result)
    }
}