package com.kiyo.app.autofill

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import android.util.Pair

import kotlin.jvm.JvmField
import kotlin.jvm.JvmStatic
import kotlin.jvm.JvmOverloads

import org.json.JSONArray
import org.json.JSONObject

/**
 * Repository for Autofill account data operations.
 * Provides CRUD operations for the autofill SQLite database.
 */
class AutofillRepository(private val context: Context) {

    private val dbHelper = AutofillDatabaseHelper(context)
    private val TAG = "AutofillRepository"

    /**
     * Data class representing an autofill account entry
     * Using @JvmField to make fields accessible from Java
     */
    data class AutofillAccount(
        @JvmField val id: Long = -1,
        @JvmField val username: String,
        @JvmField val password: String,
        @JvmField val title: String? = null,
        @JvmField val packageName: String? = null,
        @JvmField val domain: String? = null,
        @JvmField val createdAt: Long = System.currentTimeMillis(),
        @JvmField val updatedAt: Long = System.currentTimeMillis(),
        @JvmField val favorite: Boolean = false
    )

    /**
     * Insert a new account for autofill
     */
    fun insertAccount(account: AutofillAccount): Long {
        val db = dbHelper.writableDatabase
        val values = accountToContentValues(account)
        val id = db.insert(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, values)
        Log.d(TAG, "Inserted account with id: $id, username: ${account.username}")
        return id
    }

    /**
     * Insert or update an account (upsert based on username + packageName/domain)
     */
    fun upsertAccount(account: AutofillAccount): Long {
        val existing = findByUsernameAndPackage(account.username, account.packageName, account.domain)
        if (existing != null) {
            val updated = account.copy(id = existing.id, updatedAt = System.currentTimeMillis())
            updateAccount(updated)
            return existing.id
        } else {
            return insertAccount(account)
        }
    }

    /**
     * Update an existing account
     */
    fun updateAccount(account: AutofillAccount): Int {
        val db = dbHelper.writableDatabase
        val values = accountToContentValues(account)
        val count = db.update(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            values,
            "${AutofillDatabaseHelper.COLUMN_ID} = ?",
            arrayOf(account.id.toString())
        )
        Log.d(TAG, "Updated $count account(s) with id: ${account.id}")
        return count
    }

    /**
     * Delete an account by ID
     */
    fun deleteAccount(id: Long): Int {
        val db = dbHelper.writableDatabase
        val count = db.delete(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            "${AutofillDatabaseHelper.COLUMN_ID} = ?",
            arrayOf(id.toString())
        )
        Log.d(TAG, "Deleted $count account(s) with id: $id")
        return count
    }

    /**
     * Find account by username and package name (for Android apps)
     */
    fun findByUsernameAndPackage(username: String, packageName: String?, domain: String?): AutofillAccount? {
        val db = dbHelper.readableDatabase
        val selection = StringBuilder("${AutofillDatabaseHelper.COLUMN_USERNAME} = ?")
        val selectionArgs = mutableListOf(username)

        if (packageName != null && packageName.isNotEmpty()) {
            selection.append(" AND ${AutofillDatabaseHelper.COLUMN_PACKAGE_NAME} = ?")
            selectionArgs.add(packageName)
        } else if (domain != null && domain.isNotEmpty()) {
            selection.append(" AND ${AutofillDatabaseHelper.COLUMN_DOMAIN} = ?")
            selectionArgs.add(domain)
        }

        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
            selection.toString(),
            selectionArgs.toTypedArray(),
            null,
            null,
            "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC",
            "1"
        )

        return cursor.use { c ->
            if (c.moveToFirst()) {
                cursorToAccount(c)
            } else {
                null
            }
        }
    }

    /**
     * Find all accounts matching a package name (Android app)
     */
    fun findByPackageName(packageName: String): List<AutofillAccount> {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
            "${AutofillDatabaseHelper.COLUMN_PACKAGE_NAME} = ?",
            arrayOf(packageName),
            null,
            null,
            "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
        )

        return cursor.use { c ->
            val accounts = mutableListOf<AutofillAccount>()
            while (c.moveToNext()) {
                accounts.add(cursorToAccount(c))
            }
            accounts
        }
    }

    /**
     * Find all accounts matching a domain (for web autofill)
     */
    fun findByDomain(domain: String): List<AutofillAccount> {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
            "${AutofillDatabaseHelper.COLUMN_DOMAIN} = ?",
            arrayOf(domain),
            null,
            null,
            "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
        )

        return cursor.use { c ->
            val accounts = mutableListOf<AutofillAccount>()
            while (c.moveToNext()) {
                accounts.add(cursorToAccount(c))
            }
            accounts
        }
    }

    /**
     * Search accounts by username (partial match)
     */
    fun searchByUsername(query: String): List<AutofillAccount> {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
            "${AutofillDatabaseHelper.COLUMN_USERNAME} LIKE ?",
            arrayOf("%$query%"),
            null,
            null,
            "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
        )

        return cursor.use { c ->
            val accounts = mutableListOf<AutofillAccount>()
            while (c.moveToNext()) {
                accounts.add(cursorToAccount(c))
            }
            accounts
        }
    }

    /**
     * Get all accounts (for sync/management)
     */
    fun getAllAccounts(): List<AutofillAccount> {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
            null,
            null,
            null,
            null,
            "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
        )

        return cursor.use { c ->
            val accounts = mutableListOf<AutofillAccount>()
            while (c.moveToNext()) {
                accounts.add(cursorToAccount(c))
            }
            accounts
        }
    }

    /**
     * Get favorite accounts
     */
    fun getFavoriteAccounts(): List<AutofillAccount> {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
            "${AutofillDatabaseHelper.COLUMN_FAVORITE} = ?",
            arrayOf("1"),
            null,
            null,
            "${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
        )

        return cursor.use { c ->
            val accounts = mutableListOf<AutofillAccount>()
            while (c.moveToNext()) {
                accounts.add(cursorToAccount(c))
            }
            accounts
        }
    }

    /**
     * Toggle favorite status
     */
    fun toggleFavorite(id: Long): Boolean {
        val account = getAccountById(id)
        if (account == null) return false

        val updated = account.copy(favorite = !account.favorite, updatedAt = System.currentTimeMillis())
        return updateAccount(updated) > 0
    }

    /**
     * Get account by ID
     */
    fun getAccountById(id: Long): AutofillAccount? {
        val db = dbHelper.readableDatabase
        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
            "${AutofillDatabaseHelper.COLUMN_ID} = ?",
            arrayOf(id.toString()),
            null,
            null,
            null
        )

        return cursor.use { c ->
            if (c.moveToFirst()) {
                cursorToAccount(c)
            } else {
                null
            }
        }
    }

    /**
     * Delete all accounts (for testing or reset)
     */
    fun deleteAllAccounts(): Int {
        val db = dbHelper.writableDatabase
        return db.delete(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, null)
    }

    /**
     * Get account count
     */
    fun getAccountCount(): Int {
        val db = dbHelper.readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM ${AutofillDatabaseHelper.TABLE_ACCOUNTS}", null)
        return cursor.use { c ->
            if (c.moveToFirst()) c.getInt(0) else 0
        }
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
        var syncedCount = 0
        var errorCount = 0

        try {
            val jsonArray = JSONArray(accountsJson)
            val db = dbHelper.writableDatabase
            db.beginTransaction()

            try {
                // Clear existing accounts (React is source of truth)
                db.delete(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, null)

                for (i in 0 until jsonArray.length()) {
                    try {
                        val accountJson = jsonArray.getJSONObject(i)
                        val autofillAccount = parseReactAccount(accountJson)
                        if (autofillAccount != null) {
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

        return Pair(syncedCount, errorCount)
    }

    /**
     * Parse React Account JSON to AutofillAccount
     * React Account structure:
     * {
     *   id: number,
     *   templateId: number,
     *   title: string,
     *   description?: string,
     *   tags: string[],
     *   favorite: boolean,
     *   fields: AccountField[],
     *   createdAt: number,
     *   updatedAt: number
     * }
     * 
     * AccountField:
     * {
     *   id: string,
     *   accountId?: number,
     *   label: string,
     *   type: "text" | "password" | "email" | "number" | "textarea",
     *   value: string,
     *   order: number
     * }
     */
    private fun parseReactAccount(json: JSONObject): AutofillAccount? {
        try {
            // Extract username and password from fields
            var username = ""
            var password = ""
            var domain: String? = null
            var packageName: String? = null

            val fieldsArray = json.optJSONArray("fields")
            if (fieldsArray != null) {
                for (i in 0 until fieldsArray.length()) {
                    val field = fieldsArray.getJSONObject(i)
                    val label = field.optString("label", "").lowercase()
                    val type = field.optString("type", "")
                    val value = field.optString("value", "")

                    when {
                        type == "password" -> password = value
                        type == "email" -> if (username.isEmpty()) username = value
                        type == "text" -> {
                            when (label) {
                                "username", "user", "id", "login" -> if (username.isEmpty()) username = value
                                "url", "website", "domain" -> domain = extractDomain(value)
                                "package", "package name", "app", "application" -> packageName = value
                                else -> if (username.isEmpty()) username = value
                            }
                        }
                    }
                }
            }

            // Fallback: if no username found, use first text field
            if (username.isEmpty() && fieldsArray != null) {
                for (i in 0 until fieldsArray.length()) {
                    val field = fieldsArray.getJSONObject(i)
                    val type = field.optString("type", "")
                    val value = field.optString("value", "")
                    if (type == "text" && value.isNotEmpty()) {
                        username = value
                        break
                    }
                }
            }

            // Skip if no username or password
            if (username.isEmpty() || password.isEmpty()) {
                Log.w(TAG, "Skipping account with missing username/password: ${json.optString("title", "unknown")}")
                return null
            }

            val title: String? = json.optString("title").takeIf { it.isNotEmpty() }
            val favorite = json.optBoolean("favorite", false)
            val createdAt = json.optLong("createdAt", System.currentTimeMillis())
            val updatedAt = json.optLong("updatedAt", System.currentTimeMillis())

            return AutofillAccount(
                username = username,
                password = password,
                title = title,
                packageName = packageName,
                domain = domain,
                createdAt = createdAt,
                updatedAt = updatedAt,
                favorite = favorite
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing React account", e)
            return null
        }
    }

    /**
     * Extract domain from URL
     */
    private fun extractDomain(url: String): String? {
        try {
            val uri = android.net.Uri.parse(url)
            return uri.host
        } catch (e: Exception) {
            return null
        }
    }

    /**
     * Convert AutofillAccount to ContentValues for database operations
     */
    private fun accountToContentValues(account: AutofillAccount): ContentValues {
        val values = ContentValues()
        values.put(AutofillDatabaseHelper.COLUMN_USERNAME, account.username)
        values.put(AutofillDatabaseHelper.COLUMN_PASSWORD, account.password)
        values.put(AutofillDatabaseHelper.COLUMN_TITLE, account.title)
        values.put(AutofillDatabaseHelper.COLUMN_PACKAGE_NAME, account.packageName)
        values.put(AutofillDatabaseHelper.COLUMN_DOMAIN, account.domain)
        values.put(AutofillDatabaseHelper.COLUMN_CREATED_AT, account.createdAt)
        values.put(AutofillDatabaseHelper.COLUMN_UPDATED_AT, account.updatedAt)
        values.put(AutofillDatabaseHelper.COLUMN_FAVORITE, if (account.favorite) 1 else 0)
        return values
    }

    /**
     * Convert Cursor to AutofillAccount
     */
    private fun cursorToAccount(cursor: Cursor): AutofillAccount {
        return AutofillAccount(
            id = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_ID)),
            username = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_USERNAME)),
            password = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PASSWORD)),
            title = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_TITLE)),
            packageName = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PACKAGE_NAME)),
            domain = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_DOMAIN)),
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_CREATED_AT)),
            updatedAt = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_UPDATED_AT)),
            favorite = cursor.getInt(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_FAVORITE)) == 1
        )
    }

    /**
     * Close the database helper
     */
    fun close() {
        dbHelper.close()
    }
}