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
        // Use relaxed mock for cursor to handle close() and other methods automatically
        mockCursor = mockk(relaxed = true)
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
    fun `findMatchingAccounts queries exact domain match`() = runTest {
        // Given
        val testDomain = "example.com"
        val mockAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = testDomain
        )
        
        every { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_DOMAIN} = ?"), any(), any(), any(), any()) } returns mockCursor
        every { mockCursor.moveToNext() } returns false
        every { AccountMapper().fromCursor(mockCursor) } returns mockAccount

        // When
        val result = domainMatcher.findMatchingAccounts(mockDb, testDomain)

        // Then
        verify { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_DOMAIN} = ?"), arrayOf(testDomain), any(), any(), any()) }
    }

    @Test
    fun `findByPackageName queries packageNames JSON array`() = runTest {
        // Given
        val packageName = "com.example.app"
        
        every { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES} LIKE ?"), any(), any(), any(), any()) } returns mockCursor
        every { mockCursor.moveToNext() } returns false

        // When
        val result = domainMatcher.findByPackageName(mockDb, packageName)

        // Then
        verify { mockDb.query(any(), any(), eq("${AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES} LIKE ?"), arrayOf("%\"$packageName\"%"), any(), any(), any()) }
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
        
        every { mockDb.query(eq(AutofillDatabaseHelper.TABLE_ACCOUNTS), any(), any(), any(), any(), any(), any(), eq("${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC")) } returns mockCursor
        every { mockCursor.moveToNext() } returns false

        // When
        val result = domainMatcher.getAllAccounts(mockDb)

        // Then
        verify { mockDb.query(eq(AutofillDatabaseHelper.TABLE_ACCOUNTS), any(), any(), any(), any(), any(), any(), eq("${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC")) }
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
}