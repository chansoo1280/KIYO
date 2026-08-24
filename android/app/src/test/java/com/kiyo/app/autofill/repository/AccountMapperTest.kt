package com.kiyo.app.autofill.repository

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(instrumentedPackages = ["org.json"])
class AccountMapperTest {

    private val mapper = AccountMapper()

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
}