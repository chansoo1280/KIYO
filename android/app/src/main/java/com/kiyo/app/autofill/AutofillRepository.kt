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

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

/**
 * Repository for Autofill account data operations.
 * Provides CRUD operations for the autofill SQLite database.
 * All database operations run on a background thread via ExecutorService.
 */
class AutofillRepository(private val context: Context) {

    private val dbHelper = AutofillDatabaseHelper(context)
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()

    companion object {
        private const val TAG = "AutofillRepository"
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

        /**
         * Create AutofillAccount from database cursor (parses packageNames JSON)
         */
        companion object {
            fun fromCursor(cursor: Cursor): AutofillAccount {
                val encryptedPassword = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PASSWORD))
                val password = if (AutofillCrypto.isEncrypted(encryptedPassword)) {
                    AutofillCrypto.decryptPassword(encryptedPassword)
                } else {
                    // Legacy plaintext password (for backward compatibility)
                    encryptedPassword
                }

                // Parse packageNames JSON array
                val packageNamesJson = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES))
                val packageNames = if (packageNamesJson != null && packageNamesJson.isNotEmpty()) {
                    try {
                        val jsonArray = JSONArray(packageNamesJson)
                        val list = mutableListOf<String>()
                        for (i in 0 until jsonArray.length()) {
                            val pkg = jsonArray.getString(i)
                            if (pkg.isNotEmpty()) {
                                list.add(pkg)
                            }
                        }
                        list
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to parse packageNames JSON: $packageNamesJson", e)
                        emptyList()
                    }
                } else {
                    emptyList()
                }

                return AutofillAccount(
                    id = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_ID)),
                    username = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_USERNAME)),
                    password = password,
                    title = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_TITLE)),
                    packageNames = packageNames,
                    appName = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_APP_NAME)),
                    domain = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_DOMAIN)),
                    createdAt = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_CREATED_AT)),
                    updatedAt = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_UPDATED_AT)),
                    favorite = cursor.getInt(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_FAVORITE)) == 1
                )
            }
        }
    }

    /**
     * Insert a new account for autofill
     */
    fun insertAccount(account: AutofillAccount): Long {
        return executor.submit<Long> {
            val db = dbHelper.writableDatabase
            val values = accountToContentValues(account)
            val id = db.insert(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, values)
            Log.d(TAG, "Inserted account with id: $id, username: ${account.username}")
            id
        }.get()
    }

    /**
     * Insert a new account with password encryption
     */
    fun insertAccountEncrypted(account: AutofillAccount): Long {
        return executor.submit<Long> {
            val encryptedAccount = account.copy(password = AutofillCrypto.encryptPassword(account.password))
            insertAccount(encryptedAccount)
        }.get()
    }

    /**
     * Insert or update an account (upsert based on username + packageNames/domain)
     */
    fun upsertAccount(account: AutofillAccount): Long {
        return executor.submit<Long> {
            val existing = findByUsernameAndPackage(account.username, account.packageNames.firstOrNull(), account.domain)
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
            val db = dbHelper.writableDatabase
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
            val db = dbHelper.writableDatabase
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
     * Find account by username and package name (for Android apps)
     * Checks packageNames JSON array for multiple package names
     */
    fun findByUsernameAndPackage(username: String, packageName: String?, domain: String?): AutofillAccount? {
        return executor.submit<AutofillAccount?> {
            val db = dbHelper.readableDatabase
            val selection = StringBuilder("${AutofillDatabaseHelper.COLUMN_USERNAME} = ?")
            val selectionArgs = mutableListOf(username)

            if (packageName != null && packageName.isNotEmpty()) {
                // Check package_names JSON array
                selection.append(" AND ${AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES} LIKE ?")
                selectionArgs.add("%\"$packageName\"%")
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

            cursor.use { c ->
                if (c.moveToFirst()) {
                    AutofillAccount.fromCursor(c)
                } else {
                    null
                }
            }
        }.get()
    }

    /**
     * Find account by username only (for linking packageName to existing web account)
     * Returns the most recently updated account with this username
     */
    fun findByUsername(username: String): AutofillAccount? {
        return executor.submit<AutofillAccount?> {
            val db = dbHelper.readableDatabase
            val cursor = db.query(
                AutofillDatabaseHelper.TABLE_ACCOUNTS,
                null,
                "${AutofillDatabaseHelper.COLUMN_USERNAME} = ?",
                arrayOf(username),
                null,
                null,
                "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC",
                "1"
            )

            cursor.use { c ->
                if (c.moveToFirst()) {
                    cursorToAccount(c)
                } else {
                    null
                }
            }
        }.get()
    }

    /**
     * Find all accounts matching a package name (Android app)
     * Checks package_names JSON array
     */
    fun findByPackageName(packageName: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            val db = dbHelper.readableDatabase
            val cursor = db.query(
                AutofillDatabaseHelper.TABLE_ACCOUNTS,
                null,
                "${AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES} LIKE ?",
                arrayOf("%\"$packageName\"%"),
                null,
                null,
                "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
            )

            cursor.use { c ->
                val accounts = mutableListOf<AutofillAccount>()
                while (c.moveToNext()) {
                    accounts.add(AutofillAccount.fromCursor(c))
                }
                accounts
            }
        }.get()
    }

    /**
     * Find all accounts matching a domain (for web autofill)
     * Supports subdomain matching (e.g., accounts.google.com matches google.com)
     */
    fun findByDomain(domain: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
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

            cursor.use { c ->
                val accounts = mutableListOf<AutofillAccount>()
                while (c.moveToNext()) {
                    accounts.add(cursorToAccount(c))
                }
                accounts
            }
        }.get()
    }

    /**
     * Find matching accounts for autofill based on domain
     * Supports exact domain match and subdomain matching
     */
    fun findMatchingAccounts(domain: String?): List<AutofillAccount> {
        if (domain == null || domain.isEmpty()) {
            return emptyList()
        }
        
        return executor.submit<List<AutofillAccount>> {
            val db = dbHelper.readableDatabase
            
            // First try exact domain match
            var cursor = db.query(
                AutofillDatabaseHelper.TABLE_ACCOUNTS,
                null,
                "${AutofillDatabaseHelper.COLUMN_DOMAIN} = ?",
                arrayOf(domain),
                null,
                null,
                "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
            )
            
            val accounts = mutableListOf<AutofillAccount>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    accounts.add(cursorToAccount(c))
                }
            }
            
            // If no exact match, try parent domain matching (e.g., accounts.google.com -> google.com)
            if (accounts.isEmpty()) {
                val domainParts = domain.split(".")
                if (domainParts.size > 2) {
                    // Try parent domains
                    for (i in 1 until domainParts.size - 1) {
                        val parentDomain = domainParts.subList(i, domainParts.size).joinToString(".")
                        cursor = db.query(
                            AutofillDatabaseHelper.TABLE_ACCOUNTS,
                            null,
                            "${AutofillDatabaseHelper.COLUMN_DOMAIN} = ?",
                            arrayOf(parentDomain),
                            null,
                            null,
                            "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
                        )
                        cursor.use { c ->
                            while (c.moveToNext()) {
                                accounts.add(cursorToAccount(c))
                            }
                        }
                        if (accounts.isNotEmpty()) break
                    }
                }
            }
            
            accounts
        }.get()
    }

    /**
     * Search accounts by username (partial match)
     */
    fun searchByUsername(query: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
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

            cursor.use { c ->
                val accounts = mutableListOf<AutofillAccount>()
                while (c.moveToNext()) {
                    accounts.add(cursorToAccount(c))
                }
                accounts
            }
        }.get()
    }

    /**
     * Get all accounts (for sync/management)
     */
    fun getAllAccounts(): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
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

            cursor.use { c ->
                val accounts = mutableListOf<AutofillAccount>()
                while (c.moveToNext()) {
                    accounts.add(cursorToAccount(c))
                }
                accounts
            }
        }.get()
    }

    /**
     * Get favorite accounts
     */
    fun getFavoriteAccounts(): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
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

            cursor.use { c ->
                val accounts = mutableListOf<AutofillAccount>()
                while (c.moveToNext()) {
                    accounts.add(cursorToAccount(c))
                }
                accounts
            }
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
            val db = dbHelper.readableDatabase
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
                    cursorToAccount(c)
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
            val account = findByUsername(username)
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
                                // Encrypt password before storing
                                val encryptedAccount = autofillAccount.copy(password = AutofillCrypto.encryptPassword(autofillAccount.password))
                                val values = accountToContentValues(encryptedAccount)
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
     *   updatedAt: number,
     *   websiteUrl?: string,    // Original URL entered by user
     *   domain?: string,        // Normalized domain for web autofill matching
     *   packageName?: string    // Android package name for app autofill matching
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

            val fieldsArray = json.optJSONArray("fields")
            if (fieldsArray != null) {
                for (i in 0 until fieldsArray.length()) {
                    val field = fieldsArray.getJSONObject(i)
                    val type = field.optString("type", "")
                    val value = field.optString("value", "")

                    when (type) {
                        "password" -> password = value
                        "email" -> if (username.isEmpty()) username = value
                        "text" -> if (username.isEmpty()) username = value
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

            // Use dedicated domain and packageName fields from React Account model
            // These are now stored directly on the Account object
            val domain = json.optString("domain").takeIf { it.isNotEmpty() }
            val packageName = json.optString("packageName").takeIf { it.isNotEmpty() }
            val appName = json.optString("appName").takeIf { it.isNotEmpty() }

            // Fallback: extract domain from websiteUrl if domain field not set
            val finalDomain = domain ?: json.optString("websiteUrl").takeIf { it.isNotEmpty() }?.let { extractDomain(it) }

            // Fallback: extract packageName from fields if not set
            val finalPackageName = packageName ?: fieldsArray?.let { fields ->
                for (i in 0 until fields.length()) {
                    val field = fields.getJSONObject(i)
                    val label = field.optString("label", "").lowercase()
                    val value = field.optString("value", "")
                    if (label in setOf("package", "package name", "app", "application") && value.isNotEmpty()) {
                        return@let value
                    }
                }
                null
            }

            val title: String? = json.optString("title").takeIf { it.isNotEmpty() }
            val favorite = json.optBoolean("favorite", false)
            val createdAt = json.optLong("createdAt", System.currentTimeMillis())
            val updatedAt = json.optLong("updatedAt", System.currentTimeMillis())

            // Convert single packageName to packageNames list
            val packageNames = if (finalPackageName != null && finalPackageName.isNotEmpty()) {
                listOf(finalPackageName)
            } else {
                emptyList()
            }

            return AutofillAccount(
                username = username,
                password = password,
                title = title,
                packageNames = packageNames,
                appName = appName,
                domain = finalDomain,
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
        values.put(AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES, account.packageNamesToJson())
        values.put(AutofillDatabaseHelper.COLUMN_APP_NAME, account.appName)
        values.put(AutofillDatabaseHelper.COLUMN_DOMAIN, account.domain)
        values.put(AutofillDatabaseHelper.COLUMN_CREATED_AT, account.createdAt)
        values.put(AutofillDatabaseHelper.COLUMN_UPDATED_AT, account.updatedAt)
        values.put(AutofillDatabaseHelper.COLUMN_FAVORITE, if (account.favorite) 1 else 0)
        return values
    }

    /**
     * Convert Cursor to AutofillAccount with password decryption
     */
    private fun cursorToAccount(cursor: Cursor): AutofillAccount {
        val encryptedPassword = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PASSWORD))
        val password = if (AutofillCrypto.isEncrypted(encryptedPassword)) {
            AutofillCrypto.decryptPassword(encryptedPassword)
        } else {
            // Legacy plaintext password (for backward compatibility)
            encryptedPassword
        }

        // Parse packageNames JSON array
        val packageNamesJson = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES))
        val packageNames = if (packageNamesJson != null && packageNamesJson.isNotEmpty()) {
            try {
                val jsonArray = JSONArray(packageNamesJson)
                val list = mutableListOf<String>()
                for (i in 0 until jsonArray.length()) {
                    val pkg = jsonArray.getString(i)
                    if (pkg.isNotEmpty()) {
                        list.add(pkg)
                    }
                }
                list
            } catch (e: Exception) {
                Log.w(TAG, "Failed to parse packageNames JSON: $packageNamesJson", e)
                emptyList()
            }
        } else {
            emptyList()
        }

        return AutofillAccount(
            id = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_ID)),
            username = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_USERNAME)),
            password = password,
            title = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_TITLE)),
            packageNames = packageNames,
            appName = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_APP_NAME)),
            domain = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_DOMAIN)),
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_CREATED_AT)),
            updatedAt = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_UPDATED_AT)),
            favorite = cursor.getInt(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_FAVORITE)) == 1
        )
    }

    /**
     * Convert Cursor to AutofillAccount without password decryption (for admin/export)
     */
    private fun cursorToAccountRaw(cursor: Cursor): AutofillAccount {
        // Parse packageNames JSON array
        val packageNamesJson = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES))
        val packageNames = if (packageNamesJson != null && packageNamesJson.isNotEmpty()) {
            try {
                val jsonArray = JSONArray(packageNamesJson)
                val list = mutableListOf<String>()
                for (i in 0 until jsonArray.length()) {
                    val pkg = jsonArray.getString(i)
                    if (pkg.isNotEmpty()) {
                        list.add(pkg)
                    }
                }
                list
            } catch (e: Exception) {
                Log.w(TAG, "Failed to parse packageNames JSON: $packageNamesJson", e)
                emptyList()
            }
        } else {
            emptyList()
        }

        return AutofillAccount(
            id = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_ID)),
            username = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_USERNAME)),
            password = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PASSWORD)),
            title = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_TITLE)),
            packageNames = packageNames,
            appName = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_APP_NAME)),
            domain = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_DOMAIN)),
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_CREATED_AT)),
            updatedAt = cursor.getLong(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_UPDATED_AT)),
            favorite = cursor.getInt(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_FAVORITE)) == 1
        )
    }

    /**
     * Get total account count
     */
    fun getAccountCount(): Int {
        return executor.submit<Int> {
            val db = dbHelper.readableDatabase
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
            val db = dbHelper.writableDatabase
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
