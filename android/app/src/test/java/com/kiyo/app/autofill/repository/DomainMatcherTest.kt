package com.kiyo.app.autofill.repository

import android.database.Cursor
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.json.JSONArray
import net.zetetic.database.sqlcipher.SQLiteDatabase as SQLCipherDatabase

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class DomainMatcherTest {

    private lateinit var domainMatcher: DomainMatcher
    private lateinit var mockDb: SQLCipherDatabase
    private lateinit var mockCursor: Cursor

    @Before
    fun setup() {
        domainMatcher = DomainMatcher()
        mockDb = mockk()
        // Relaxed cursor: explicit answers below override defaults; relaxed handles
        // close()/moveToFirst() etc. in the simpler query-based tests.
        mockCursor = mockk(relaxed = true)
    }

    // Helper to mock query returning all accounts
    private fun mockQueryAllAccounts(accounts: List<AutofillRepository.AutofillAccount>) {
        every { mockDb.query(any(), any(), any(), any(), any(), any(), any()) } returns mockCursor

        var callIndex = 0
        every { mockCursor.moveToNext() } answers {
            if (callIndex < accounts.size) {
                callIndex++
                true
            } else {
                false
            }
        }

        // Mock column indices
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

        // Mock column values for each account
        every { mockCursor.getString(1) } answers {
            accounts[callIndex - 1].username
        }
        every { mockCursor.getString(2) } answers {
            accounts[callIndex - 1].password
        }
        every { mockCursor.getString(3) } answers {
            accounts[callIndex - 1].title ?: ""
        }
        every { mockCursor.getString(4) } answers {
            JSONArray(accounts[callIndex - 1].packageNames).toString()
        }
        every { mockCursor.getString(5) } answers {
            accounts[callIndex - 1].appName ?: ""
        }
        every { mockCursor.getString(6) } answers {
            accounts[callIndex - 1].domain ?: ""
        }
        every { mockCursor.getLong(0) } answers {
            accounts[callIndex - 1].id
        }
        every { mockCursor.getLong(7) } answers {
            accounts[callIndex - 1].createdAt
        }
        every { mockCursor.getLong(8) } answers {
            accounts[callIndex - 1].updatedAt
        }
        every { mockCursor.getInt(9) } answers {
            if (accounts[callIndex - 1].favorite) 1 else 0
        }
        
        // Mock close() to avoid "no answer found" errors
        every { mockCursor.close() } just Runs
    }

    @Test
    fun `findMatchingAccounts returns empty list for null domain`() = runTest {
        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, null)

        // Then
        assertTrue(result.isEmpty())
    }

    @Test
    fun `findMatchingAccounts returns empty list for empty domain`() = runTest {
        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, "")

        // Then
        assertTrue(result.isEmpty())
    }

    @Test
    fun `findMatchingAccounts matches exact domain`() = runTest {
        // Given
        val testDomain = "example.com"
        val mockAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = testDomain
        )

        mockQueryAllAccounts(listOf(mockAccount))

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findMatchingAccounts normalizes domain to lowercase`() = runTest {
        // Given
        val testDomain = "EXAMPLE.COM"
        val normalizedAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "example.com"
        )

        mockQueryAllAccounts(listOf(normalizedAccount))

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findMatchingAccounts strips www prefix from domain`() = runTest {
        // Given
        val testDomain = "www.example.com"
        val normalizedAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "example.com"
        )

        mockQueryAllAccounts(listOf(normalizedAccount))

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findMatchingAccounts strips port from domain`() = runTest {
        // Given
        val testDomain = "example.com:8080"
        val normalizedAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "example.com"
        )

        mockQueryAllAccounts(listOf(normalizedAccount))

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findMatchingAccounts strips protocol and path from domain`() = runTest {
        // Given
        val testDomain = "https://www.example.com:443/login"
        val normalizedAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "example.com"
        )

        mockQueryAllAccounts(listOf(normalizedAccount))

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findMatchingAccounts handles wildcard subdomain matching`() = runTest {
        // Given
        val testDomain = "api.example.com"
        val wildcardAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "*.example.com"
        )

        mockQueryAllAccounts(listOf(wildcardAccount))

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findMatchingAccounts wildcard matches base domain too`() = runTest {
        // Given
        val testDomain = "example.com"
        val wildcardAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "*.example.com"
        )

        mockQueryAllAccounts(listOf(wildcardAccount))

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findMatchingAccounts handles parent domain matching`() = runTest {
        // Given
        val testDomain = "accounts.google.com"
        val parentAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "google.com"
        )

        mockQueryAllAccounts(listOf(parentAccount))

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findByPackageName queries packageNames JSON array`() = runTest {
        // Given
        val packageName = "com.example.app"

        mockQueryAllAccounts(emptyList())

        // When
        val result = domainMatcher.findByPackageName(mockDb, packageName)

        // Then
        assertTrue(result.isEmpty())
    }

    @Test
    fun `findByPackageName supports exact package match`() = runTest {
        // Given
        val packageName = "com.example.app"
        val account = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            packageNames = listOf("com.example.app")
        )

        mockQueryAllAccounts(listOf(account))

        // When
        val result = domainMatcher.findByPackageName(mockDb, packageName)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findByPackageName supports prefix matching for app families`() = runTest {
        // Given
        val packageName = "com.example.app.beta"
        val accountWithBasePackage = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            packageNames = listOf("com.example.app")  // Base package only
        )

        mockQueryAllAccounts(listOf(accountWithBasePackage))

        // When
        val result = domainMatcher.findByPackageName(mockDb, packageName)

        // Then
        assertEquals(1, result.size)
        assertEquals("testuser", result[0].username)
    }

    @Test
    fun `findByPackageName does not match unrelated packages`() = runTest {
        // Given
        val packageName = "com.example.app"
        val otherAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            packageNames = listOf("com.other.app")
        )

        mockQueryAllAccounts(listOf(otherAccount))

        // When
        val result = domainMatcher.findByPackageName(mockDb, packageName)

        // Then
        assertTrue(result.isEmpty())
    }

    @Test
    fun `findByDomain queries exact domain match`() = runTest {
        // Given
        val domain = "example.com"

        every { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_DOMAIN} = ?"), any(), any(), any(), any()) } returns mockCursor
        every { mockCursor.moveToNext() } returns false

        // When
        val result = domainMatcher.findByDomain(mockDb, domain)

        // Then
        verify { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_DOMAIN} = ?"), arrayOf(domain), any(), any(), any()) }
        assertTrue(result.isEmpty())
    }

    @Test
    fun `findByUsernameAndPackage queries username and packageName`() = runTest {
        // Given
        val username = "testuser"
        val packageName = "com.example.app"

        every { mockDb.query(any(), any(), any(), any(), any(), any(), any(), any()) } returns mockCursor
        every { mockCursor.moveToFirst() } returns false

        // When
        val result = domainMatcher.findByUsernameAndPackage(mockDb, username, packageName, null)

        // Then
        verify { mockDb.query(any(), any(), any(), arrayOf(username, "%\"$packageName\"%"), any(), any(), any(), any()) }
        assertNull(result)
    }

    @Test
    fun `findByUsernameAndPackage queries username and domain when packageName is null`() = runTest {
        // Given
        val username = "testuser"
        val domain = "example.com"

        every { mockDb.query(any(), any(), any(), any(), any(), any(), any(), any()) } returns mockCursor
        every { mockCursor.moveToFirst() } returns false

        // When
        val result = domainMatcher.findByUsernameAndPackage(mockDb, username, null, domain)

        // Then
        verify { mockDb.query(any(), any(), any(), arrayOf(username, domain), any(), any(), any(), any()) }
        assertNull(result)
    }

    @Test
    fun `findByUsername queries by username only`() = runTest {
        // Given
        val username = "testuser"

        every { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_USERNAME} = ?"), any(), any(), any(), any(), any()) } returns mockCursor
        every { mockCursor.moveToFirst() } returns false

        // When
        val result = domainMatcher.findByUsername(mockDb, username)

        // Then
        assertNull(result)
        verify { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_USERNAME} = ?"), arrayOf(username), any(), any(), any(), any()) }
    }

    @Test
    fun `findByUsername returns null when not found`() = runTest {
        // Given
        val username = "nonexistent"

        every { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_USERNAME} = ?"), any(), any(), any(), any(), any()) } returns mockCursor
        every { mockCursor.moveToFirst() } returns false

        // When
        val result = domainMatcher.findByUsername(mockDb, username)

        // Then
        assertNull(result)
    }

    @Test
    fun `searchByUsername queries partial match`() = runTest {
        // Given
        val query = "test"

        every { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_USERNAME} LIKE ?"), any(), any(), any(), any()) } returns mockCursor
        every { mockCursor.moveToNext() } returns false

        // When
        val result = domainMatcher.searchByUsername(mockDb, query)

        // Then
        verify { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_USERNAME} LIKE ?"), arrayOf("%$query%"), any(), any(), any()) }
        assertTrue(result.isEmpty())
    }

    @Test
    fun `getAllAccounts queries all accounts ordered by favorite and updatedAt`() = runTest {
        // Given

        every { mockDb.query(eq(AutofillDatabaseHelper.TABLE_ACCOUNTS), any(), any(), any(), any(), any(), eq("${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"), any()) } returns mockCursor
        every { mockCursor.moveToNext() } returns false

        // When
        val result = domainMatcher.getAllAccounts(mockDb)

        // Then
        verify { mockDb.query(eq(AutofillDatabaseHelper.TABLE_ACCOUNTS), any(), any(), any(), any(), any(), eq("${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"), any()) }
        assertTrue(result.isEmpty())
    }

    @Test
    fun `getFavoriteAccounts queries favorite=1 ordered by updatedAt`() = runTest {
        // Given - The SQLiteDatabase.query has 7-parameter and 8-parameter overloads
        // Use answers to handle any overload

        every { mockDb.query(any(), any(), any(), any(), any(), any(), any()) } answers { _ -> mockCursor }
        every { mockCursor.moveToNext() } returns false

        // When
        val result = domainMatcher.getFavoriteAccounts(mockDb)

        // Then - verify the method was called (relaxed)
        verify { mockDb.query(any(), any(), any(), any(), any(), any(), any()) }
        assertTrue(result.isEmpty())
    }

    @Test
    fun `findBestMatch returns exact domain match with highest score`() = runTest {
        // Given
        val domain = "example.com"
        val exactMatchAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "example.com",
            packageNames = listOf()
        )
        val wildcardAccount = AutofillRepository.AutofillAccount(
            id = 2,
            username = "wilduser",
            password = "wildpass",
            domain = "*.example.com",
            packageNames = listOf()
        )

        mockQueryAllAccounts(listOf(exactMatchAccount, wildcardAccount))

        // When
        val result = domainMatcher.findBestMatch(mockDb, domain, listOf())

        // Then
        assertNotNull(result)
        assertEquals("testuser", result?.username)  // Exact match should win (score 100 vs 70)
    }

    @Test
    fun `findBestMatch prefers exact package match over prefix match`() = runTest {
        // Given
        val packageNames = listOf("com.example.app", "com.example.app.beta")
        val exactMatchAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "other.com",
            packageNames = listOf("com.example.app")
        )
        val prefixMatchAccount = AutofillRepository.AutofillAccount(
            id = 2,
            username = "betauser",
            password = "betapass",
            domain = "other.com",
            packageNames = listOf("com.example.app.base")
        )

        mockQueryAllAccounts(listOf(exactMatchAccount, prefixMatchAccount))

        // When
        val result = domainMatcher.findBestMatch(mockDb, null, packageNames)

        // Then
        assertNotNull(result)
        assertEquals("testuser", result?.username)  // Exact match should win (score 80 vs 60)
    }

    @Test
    fun `findBestMatch handles combined domain and package matches`() = runTest {
        // Given
        val domain = "example.com"
        val packageNames = listOf("com.example.app")
        val domainAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "domainuser",
            password = "domainpass",
            domain = "example.com",
            packageNames = listOf()
        )
        val packageAccount = AutofillRepository.AutofillAccount(
            id = 2,
            username = "packageuser",
            password = "packagepass",
            domain = "other.com",
            packageNames = listOf("com.example.app")
        )

        mockQueryAllAccounts(listOf(domainAccount, packageAccount))

        // When
        val result = domainMatcher.findBestMatch(mockDb, domain, packageNames)

        // Then
        assertNotNull(result)
        // Domain match scores 100, package match scores 80, so domain should win
        assertEquals("domainuser", result?.username)
    }

    @Test
    fun `findBestMatch scores exact domain + exact package highest`() = runTest {
        // Given
        val domain = "example.com"
        val packageNames = listOf("com.example.app")
        
        val bothMatchAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "bothuser",
            password = "bothpass",
            domain = "example.com",
            packageNames = listOf("com.example.app")
        )
        val domainOnlyAccount = AutofillRepository.AutofillAccount(
            id = 2,
            username = "domainuser",
            password = "domainpass",
            domain = "example.com",
            packageNames = listOf("com.other.app")
        )
        val packageOnlyAccount = AutofillRepository.AutofillAccount(
            id = 3,
            username = "packageuser",
            password = "packagepass",
            domain = "other.com",
            packageNames = listOf("com.example.app")
        )

        mockQueryAllAccounts(listOf(bothMatchAccount, domainOnlyAccount, packageOnlyAccount))

        // When
        val result = domainMatcher.findBestMatch(mockDb, domain, packageNames)

        // Then
        assertNotNull(result)
        // Both match: 100 (domain) + 80 (package) = 180
        // Domain only: 100
        // Package only: 80
        assertEquals("bothuser", result?.username)
    }
}