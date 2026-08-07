package com.kiyo.app.autofill.repository

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import android.util.Pair

import com.kiyo.app.security.DatabaseKeyManager

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

import kotlin.jvm.JvmField
import kotlin.jvm.JvmStatic
import kotlin.jvm.JvmOverloads

import org.json.JSONArray
import org.json.JSONObject

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import net.zetetic.database.sqlcipher.SQLiteDatabase as SQLCipherDatabase

/**
 * Repository for Autofill account data operations.
 * Provides CRUD operations for the autofill SQLite database (encrypted via SQLCipher).
 * All database operations run on a background thread via ExecutorService.
 */
class AutofillRepository internal constructor(
    private val context: Context,
    private val dbHelper: AutofillDatabaseHelper
) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val accountMapper = AccountMapper()
    private val domainMatcher = DomainMatcher()

    companion object {
        private const val TAG = "AutofillRepository"

        /**
         * Create AutofillRepository asynchronously.
         * Gets encryption key from DatabaseKeyManager (suspend) and initializes dbHelper.
         */
        suspend fun create(context: Context): AutofillRepository = withContext(Dispatchers.IO) {
            val encryptionKey = DatabaseKeyManager.getKey(context).encoded
            val dbHelper = AutofillDatabaseHelper(context, encryptionKey)
            AutofillRepository(context, dbHelper)
        }
    }

    /**
     * Data class representing an autofill account entry
     * Using @JvmField to make fields accessible from Java
     * Uses packageNames List<String> for multiple package names per account
     */
    data class AutofillAccount(
        @JvmField val id: Long = -1,
        @JvmField val username: String,
        @JvmField val password: String,
        @JvmField val title: String? = null,
        @JvmField val packageNames: List<String> = emptyList(), // List of package names for multiple apps
        @JvmField val appName: String? = null,
        @JvmField val domain: String? = null,
        @JvmField val createdAt: Long = System.currentTimeMillis(),
        @JvmField val updatedAt: Long = System.currentTimeMillis(),
        @JvmField val favorite: Boolean = false
    ) {
        /**
         * Check if a package name is associated with this account
         */
        fun hasPackageName(packageName: String): Boolean {
            return packageNames.contains(packageName)
        }

        /**
         * Add a package name to the account (returns new account with updated packageNames)
         */
        fun addPackageName(newPackageName: String): AutofillAccount {
            val currentNames = packageNames.toMutableList()
            if (currentNames.contains(newPackageName)) {
                return this // Already exists
            }
            currentNames.add(newPackageName)
            return copy(packageNames = currentNames, updatedAt = System.currentTimeMillis())
        }

        /**
         * Convert packageNames list to JSON string for database storage
         */
        fun packageNamesToJson(): String? {
            return if (packageNames.isNotEmpty()) {
                JSONArray(packageNames).toString()
            } else {
                null
            }
        }
    }

    /**
     * Insert a new account for autofill
     */
    fun insertAccount(account: AutofillAccount): Long {
        return executor.submit<Long> {
            val db = dbHelper.getWritableDatabase()
            val values = accountToContentValues(account)
            val id = db.insert(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, values)
            Log.d(TAG, "Inserted account with id: $id, username: ${account.username}")
            id
        }.get()
    }

    /**
     * Insert or update an account (upsert based on username + packageNames/domain)
     */
    fun upsertAccount(account: AutofillAccount): Long {
        return executor.submit<Long> {
            val existing = domainMatcher.findByUsernameAndPackage(dbHelper.getReadableDatabase(), account.username, account.packageNames.firstOrNull(), account.domain)
            if (existing != null) {
                val updated = account.copy(id = existing.id, updatedAt = System.currentTimeMillis())
                updateAccount(updated)
                existing.id
            } else {
                insertAccount(account)
            }
        }.get()
    }

    /**
     * Update an existing account
     */
    fun updateAccount(account: AutofillAccount): Int {
        return executor.submit<Int> {
            val db = dbHelper.getWritableDatabase()
            val values = accountToContentValues(account)
            val count = db.update(
                AutofillDatabaseHelper.TABLE_ACCOUNTS,
                values,
                "${AutofillDatabaseHelper.COLUMN_ID} = ?",
                arrayOf(account.id.toString())
            )
            Log.d(TAG, "Updated $count account(s) with id: ${account.id}")
            count
        }.get()
    }

    /**
     * Delete an account by ID
     */
    fun deleteAccount(id: Long): Int {
        return executor.submit<Int> {
            val db = dbHelper.getWritableDatabase()
            val count = db.delete(
                AutofillDatabaseHelper.TABLE_ACCOUNTS,
                "${AutofillDatabaseHelper.COLUMN_ID} = ?",
                arrayOf(id.toString())
            )
            Log.d(TAG, "Deleted $count account(s) with id: $id")
            count
        }.get()
    }

    /**
     * Find matching accounts for autofill based on domain
     * Supports exact domain match and subdomain matching
     */
    fun findMatchingAccounts(domain: String?): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.findMatchingAccounts(dbHelper.getReadableDatabase(), domain)
        }.get()
    }

    /**
     * Search accounts by username (partial match)
     */
    fun searchByUsername(query: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.searchByUsername(dbHelper.getReadableDatabase(), query)
        }.get()
    }

    /**
     * Find all accounts matching a package name (Android app)
     * Checks package_names JSON array
     */
    fun findByPackageName(packageName: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.findByPackageName(dbHelper.getReadableDatabase(), packageName)
        }.get()
    }

    /**
     * Find all accounts matching a domain (for web autofill)
     * Exact domain match only (subdomain matching handled by findMatchingAccounts)
     */
    fun findByDomain(domain: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.findByDomain(dbHelper.getReadableDatabase(), domain)
        }.get()
    }

    /**
     * Get all accounts (for sync/management)
     */
    fun getAllAccounts(): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.getAllAccounts(dbHelper.getReadableDatabase())
        }.get()
    }

    /**
     * Get favorite accounts
     */
    fun getFavoriteAccounts(): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.getFavoriteAccounts(dbHelper.getReadableDatabase())
        }.get()
    }

    /**
     * Toggle favorite status
     */
    fun toggleFavorite(id: Long): Boolean {
        return executor.submit<Boolean> {
            val account = getAccountById(id)
            if (account == null) return@submit false

            val updated = account.copy(favorite = !account.favorite, updatedAt = System.currentTimeMillis())
            updateAccount(updated) > 0
        }.get()
    }

    /**
     * Get account by ID
     */
    fun getAccountById(id: Long): AutofillAccount? {
        return executor.submit<AutofillAccount?> {
            val db = dbHelper.getReadableDatabase()
            val cursor = db.query(
                AutofillDatabaseHelper.TABLE_ACCOUNTS,
                null,
                "${AutofillDatabaseHelper.COLUMN_ID} = ?",
                arrayOf(id.toString()),
                null,
                null,
                null,
                "1"
            )

            cursor.use { c ->
                if (c.moveToFirst()) {
                    accountMapper.fromCursor(c)
                } else {
                    null
                }
            }
        }.get()
    }

    /**
     * Add a package name to an existing account (for packageName auto-learning)
     * Only adds if the account doesn't already have this package name
     * Returns true if package name was added, false if already exists or account not found
     */
    fun addPackageNameToAccount(accountId: Long, packageName: String): Boolean {
        return executor.submit<Boolean> {
            val account = getAccountById(accountId)
            if (account == null) {
                Log.w(TAG, "Account not found for id: $accountId")
                return@submit false
            }

            // Check if package name already exists
            if (account.hasPackageName(packageName)) {
                Log.d(TAG, "Package name $packageName already exists for account ${account.username}")
                return@submit false
            }

            // Add package name
            val updatedAccount = account.addPackageName(packageName)
            val count = updateAccount(updatedAccount)
            if (count > 0) {
                Log.d(TAG, "Added package name $packageName to account ${account.username} (id: $accountId)")
                return@submit true
            }
            return@submit false
        }.get()
    }

    /**
     * Add package name to account by username (for packageName auto-learning during save)
     * Finds account by username and adds packageName if not already present
     */
    fun addPackageNameToAccountByUsername(username: String, packageName: String): Boolean {
        return executor.submit<Boolean> {
            val account = domainMatcher.findByUsername(dbHelper.getReadableDatabase(), username)
            if (account == null) {
                Log.w(TAG, "Account not found for username: $username")
                return@submit false
            }
            addPackageNameToAccount(account.id, packageName)
        }.get()
    }

    /**
     * Sync accounts from React (JSON array)
     * React is the source of truth - SQLite is a cache for Autofill only
     * Accounts are NOT modified on Android side
     *
     * @param accountsJson JSON array of accounts from React
     * @return Pair of (syncedCount, errorCount)
     */
    fun syncAccountsFromReact(accountsJson: String): Pair<Int, Int> {
        return executor.submit<Pair<Int, Int>> {
            var syncedCount = 0
            var errorCount = 0

            try {
                val jsonArray = JSONArray(accountsJson)
                val db = dbHelper.getWritableDatabase()
                db.beginTransaction()

                try {
                    // Clear existing accounts (React is source of truth)
                    db.delete(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, null)

                    for (i in 0 until jsonArray.length()) {
                        try {
                            val accountJson = jsonArray.getJSONObject(i)
                            val autofillAccount = accountMapper.parseReactAccount(accountJson)
                            if (autofillAccount != null) {
                                // Store password directly (DB is encrypted via SQLCipher)
                                val values = accountToContentValues(autofillAccount)
                                val id = db.insert(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, values)
                                if (id != -1L) {
                                    syncedCount++
                                } else {
                                    errorCount++
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Error syncing account at index $i", e)
                            errorCount++
                        }
                    }

                    db.setTransactionSuccessful()
                } finally {
                    db.endTransaction()
                }

                Log.d(TAG, "Sync completed: synced=$syncedCount, errors=$errorCount")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse accounts JSON", e)
                errorCount++
            }

            Pair(syncedCount, errorCount)
        }.get()
    }

    /**
     * Convert AutofillAccount to ContentValues for database operations
     */
    private fun accountToContentValues(account: AutofillAccount): ContentValues {
        val values = ContentValues()
        values.put(AutofillDatabaseHelper.COLUMN_USERNAME, account.username)
        values.put(AutofillDatabaseHelper.COLUMN_PASSWORD, account.password)
        values.put(AutofillDatabaseHelper.COLUMN_TITLE, account.title)
        values.put(AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES, account.packageNamesToJson())
        values.put(AutofillDatabaseHelper.COLUMN_APP_NAME, account.appName)
        values.put(AutofillDatabaseHelper.COLUMN_DOMAIN, account.domain)
        values.put(AutofillDatabaseHelper.COLUMN_CREATED_AT, account.createdAt)
        values.put(AutofillDatabaseHelper.COLUMN_UPDATED_AT, account.updatedAt)
        values.put(AutofillDatabaseHelper.COLUMN_FAVORITE, if (account.favorite) 1 else 0)
        return values
    }

    /**
     * Get total account count
     */
    fun getAccountCount(): Int {
        return executor.submit<Int> {
            val db = dbHelper.getReadableDatabase()
            val cursor = db.rawQuery("SELECT COUNT(*) FROM ${AutofillDatabaseHelper.TABLE_ACCOUNTS}", null)
            cursor.use { c ->
                if (c.moveToFirst()) c.getInt(0) else 0
            }
        }.get()
    }

    /**
     * Delete all accounts
     */
    fun deleteAllAccounts(): Int {
        return executor.submit<Int> {
            val db = dbHelper.getWritableDatabase()
            db.delete(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, null)
        }.get()
    }

    /**
     * Close the database helper and shutdown executor
     */
    fun close() {
        dbHelper.close()
        executor.shutdown()
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow()
            }
        } catch (e: InterruptedException) {
            executor.shutdownNow()
            Thread.currentThread().interrupt()
        }
    }
}