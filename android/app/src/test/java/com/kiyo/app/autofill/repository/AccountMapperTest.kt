package com.kiyo.app.autofill.repository

import android.database.Cursor
import io.mockk.every
import io.mockk.mockk
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(instrumentedPackages = ["org.json"])
class AccountMapperTest {

    private val mapper = AccountMapper()
    private lateinit var mockCursor: Cursor

    @Before
    fun setup() {
        mockCursor = mockk(relaxed = true)
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_ID) } returns 0
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_USERNAME) } returns 1
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PASSWORD) } returns 2
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_TITLE) } returns 3
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES) } returns 4
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_APP_NAME) } returns 5
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_DOMAIN) } returns 6
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_CREATED_AT) } returns 7
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_UPDATED_AT) } returns 8
        every { mockCursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_FAVORITE) } returns 9
        every { mockCursor.getLong(0) } returns 1L
        every { mockCursor.getLong(7) } returns 1000L
        every { mockCursor.getLong(8) } returns 2000L
        every { mockCursor.getInt(9) } returns 0
        every { mockCursor.getString(3) } returns "Test Account"
        every { mockCursor.getString(4) } returns "[]"
        every { mockCursor.getString(5) } returns "Test App"
        every { mockCursor.getString(6) } returns "example.com"
    }

    @Test
    fun `parseReactAccount extracts username and password from fields`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertEquals("test@example.com", result!!.username)
        assertEquals("secret123", result.password)
        assertEquals("Test Account", result.title)
    }

    @Test
    fun `parseReactAccount uses first text field as username fallback`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "text"); put("value", "fallbackuser") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertEquals("fallbackuser", result!!.username)
        assertEquals("secret123", result.password)
    }

    @Test
    fun `parseReactAccount returns null when username missing`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNull(result)
    }

    @Test
    fun `parseReactAccount returns null when password missing`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
            })
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNull(result)
    }

    @Test
    fun `parseReactAccount uses dedicated domain field`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("domain", "example.com")
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertEquals("example.com", result!!.domain)
    }

    @Test
    fun `parseReactAccount extracts domain from websiteUrl`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("websiteUrl", "https://example.com/path")
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertEquals("example.com", result!!.domain)
    }

    @Test
    fun `parseReactAccount uses dedicated packageName field`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("packageName", "com.example.app")
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertEquals(listOf("com.example.app"), result!!.packageNames)
    }

    @Test
    fun `parseReactAccount extracts packageName from fields fallback`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
                put(JSONObject().apply { put("label", "package"); put("value", "com.example.fallback") })
            })
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertEquals(listOf("com.example.fallback"), result!!.packageNames)
    }

    @Test
    fun `parseReactAccount extracts appName`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("appName", "Example App")
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertEquals("Example App", result!!.appName)
    }

    @Test
    fun `parseReactAccount sets favorite flag`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("favorite", true)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertTrue(result!!.favorite)
    }

    @Test
    fun `parseReactAccount uses createdAt and updatedAt from JSON`() {
        val createdAt = 1000000L
        val updatedAt = 2000000L
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray().apply {
                put(JSONObject().apply { put("type", "email"); put("value", "test@example.com") })
                put(JSONObject().apply { put("type", "password"); put("value", "secret123") })
            })
            put("createdAt", createdAt)
            put("updatedAt", updatedAt)
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNotNull(result)
        assertEquals(createdAt, result!!.createdAt)
        assertEquals(updatedAt, result!!.updatedAt)
    }

    @Test
    fun `parseReactAccount handles empty fields array`() {
        val json = JSONObject().apply {
            put("title", "Test Account")
            put("fields", JSONArray())
            put("favorite", false)
        }

        val result = mapper.parseReactAccount(json)

        assertNull(result)
    }

    @Test
    fun `extractDomain extracts host from URL`() {
        val result = mapper.extractDomain("https://example.com/path/to/page")
        assertEquals("example.com", result)

        val result2 = mapper.extractDomain("http://sub.example.com:8080/path")
        assertEquals("sub.example.com", result2)

        val result3 = mapper.extractDomain("invalid-url")
        assertNull(result3)
    }

    // ===== fromCursor corrupt-row guard =====

    @Test
    fun `fromCursor returns null when username is null`() {
        every { mockCursor.getString(1) } returns null
        every { mockCursor.getString(2) } returns "validPassword"

        val result = mapper.fromCursor(mockCursor)

        assertNull(result)
    }

    @Test
    fun `fromCursor returns null when username is empty`() {
        every { mockCursor.getString(1) } returns ""
        every { mockCursor.getString(2) } returns "validPassword"

        val result = mapper.fromCursor(mockCursor)

        assertNull(result)
    }

    @Test
    fun `fromCursor returns null when password is empty`() {
        every { mockCursor.getString(1) } returns "validUser"
        every { mockCursor.getString(2) } returns ""

        val result = mapper.fromCursor(mockCursor)

        assertNull(result)
    }

    @Test
    fun `fromCursor returns null when password is null`() {
        every { mockCursor.getString(1) } returns "validUser"
        every { mockCursor.getString(2) } returns null

        val result = mapper.fromCursor(mockCursor)

        assertNull(result)
    }

    @Test
    fun `fromCursor returns account for normal row`() {
        every { mockCursor.getString(1) } returns "test@example.com"
        every { mockCursor.getString(2) } returns "secret123"

        val result = mapper.fromCursor(mockCursor)

        assertNotNull(result)
        assertEquals(1L, result!!.id)
        assertEquals("test@example.com", result.username)
        assertEquals("secret123", result.password)
        assertEquals("Test Account", result.title)
        assertEquals("example.com", result.domain)
    }
}