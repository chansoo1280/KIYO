package com.kiyo.app.testutil

import android.content.Context
import android.content.ContentValues
import android.util.Log
import net.zetetic.database.sqlcipher.SQLiteDatabase
import net.zetetic.database.sqlcipher.SQLiteDatabase as SQLCipherDatabase

/**
 * Test utility for setting up autofill test data without Keystore access.
 * Uses a fixed test encryption key to bypass Keystore/DatabaseKeyManager.
 */
object AutofillTestDataManager {

    private const val TAG = "AutofillTestDataManager"
    // Test-only encryption key (32 bytes for AES-256)
    private val TEST_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef".toByteArray()
    private const val TABLE_ACCOUNTS = "autofill_accounts"

    /**
     * Initialize test database with test accounts, bypassing Keystore.
     * Uses a fixed test encryption key instead of Keystore-managed key.
     */
    fun setupTestAccounts(context: Context, accounts: List<TestAccount>): Boolean {
        Log.d(TAG, "Setting up test accounts (bypassing Keystore)")
        
        val dbFile = context.getDatabasePath("kiyo_autofill.db")
        val dbDir = dbFile.parentFile
        if (!dbDir.exists()) {
            dbDir.mkdirs()
        }

        var success = false
        var db: net.zetetic.database.sqlcipher.SQLiteDatabase? = null
        
        try {
            // Open database with test encryption key (ByteArray)
            val dbFile = context.getDatabasePath("kiyo_autofill.db")
            db = SQLCipherDatabase.openOrCreateDatabase(
                dbFile,
                TEST_ENCRYPTION_KEY,
                null, // CursorFactory
                null  // DatabaseErrorHandler
            )
            
            // Create table if not exists (matching AutofillDatabaseHelper schema)
            createTableIfNotExists(db)
            
            // Clear existing test data
            db.delete(TABLE_ACCOUNTS, null, null)
            
            // Insert test accounts
            for (account in accounts) {
                val values = android.content.ContentValues().apply {
                    put("username", account.username)
                    put("password", account.password)
                    put("title", account.title)
                    put("package_names", account.packageNamesJson)
                    put("app_name", account.appName)
                    put("domain", account.domain)
                    put("created_at", account.createdAt)
                    put("updated_at", account.updatedAt)
                    put("favorite", if (account.favorite) 1 else 0)
                }
                
                val id = db.insert(TABLE_ACCOUNTS, null, values)
                Log.d(TAG, "Inserted test account: ${account.username} (id=$id)")
            }
            
            success = true
            Log.d(TAG, "Test accounts setup completed successfully")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to setup test accounts", e)
        } finally {
            db?.close()
        }
        
        return success
    }

    private fun createTableIfNotExists(db: net.zetetic.database.sqlcipher.SQLiteDatabase) {
        val sql = """
            CREATE TABLE IF NOT EXISTS $TABLE_ACCOUNTS (
                _id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                title TEXT,
                package_names TEXT,
                app_name TEXT,
                domain TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                favorite INTEGER NOT NULL DEFAULT 0
            )
        """.trimIndent()
        db.execSQL(sql)
    }

    /**
     * Clear all test data from the database
     */
    fun clearTestData(context: Context): Boolean {
        Log.d(TAG, "Clearing test data")
        
        try {
            val dbFile = context.getDatabasePath("kiyo_autofill.db")
            val db = net.zetetic.database.sqlcipher.SQLiteDatabase.openOrCreateDatabase(
                dbFile,
                TEST_ENCRYPTION_KEY,
                null, // CursorFactory
                null  // DatabaseErrorHandler
            )
            db.delete(TABLE_ACCOUNTS, null, null)
            db.close()
            Log.d(TAG, "Test data cleared")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear test data", e)
            return false
        }
    }

    /**
     * Test account data class
     */
    data class TestAccount(
        val username: String,
        val password: String,
        val title: String? = null,
        val packageNames: List<String> = emptyList(),
        val appName: String? = null,
        val domain: String? = null,
        val createdAt: Long = System.currentTimeMillis(),
        val updatedAt: Long = System.currentTimeMillis(),
        val favorite: Boolean = false
    ) {
        val packageNamesJson: String?
            get() = if (packageNames.isNotEmpty()) {
                org.json.JSONArray(packageNames).toString()
            } else {
                null
            }
    }
}