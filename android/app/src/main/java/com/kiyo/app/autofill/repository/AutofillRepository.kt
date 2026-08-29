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
    private val dbHelper: AutofillDatabaseHelper?,
    private val indexDbHelper: AutofillIndexDatabaseHelper? = null
) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val accountMapper = AccountMapper()
    private val domainMatcher = DomainMatcher()

    companion object {
        private const val TAG = "AutofillRepository"

        /**
         * [신규 — Autofill Matching Layer plan 2026-08-28]
         * 프로덕션 경로: DB_KEY + INDEX_KEY 모두 주입.
         * SyncManager.ensureRepository()가 호출하는 유일한 경로.
         */
        @JvmStatic
        fun create(context: Context, dbKey: ByteArray, indexKey: ByteArray): AutofillRepository {
            val helper = AutofillDatabaseHelper(context, dbKey)
            val indexHelper = AutofillIndexDatabaseHelper(context, indexKey)
            Log.d(TAG, "Repository created with index helper (production path)")
            return AutofillRepository(context, helper, indexHelper)
        }

        /**
         * [기존 유지] 테스트/롤백 경로 — 메인 DB만. indexDbHelper=null.
         * findMatchingAccountIdsByIndex는 emptyList 반환 (의도된 동작).
         */
        @JvmStatic
        fun create(context: Context, dbKey: ByteArray): AutofillRepository {
            val helper = AutofillDatabaseHelper(context, dbKey)
            return AutofillRepository(context, helper)
        }

        /**
         * [신규 — Autofill Matching Layer plan 2026-08-28]
         * Fill 요청 1단계용: 인덱스 DB만 열기 (메인 DB 키 불필요).
         * non-auth 키이므로 UserNotAuthenticatedException 발생 안 함.
         */
        @JvmStatic
        fun createForIndexOnly(context: Context, indexKey: ByteArray): AutofillRepository {
            val indexHelper = AutofillIndexDatabaseHelper(context, indexKey)
            return AutofillRepository(context, null, indexHelper)
        }

        /**
         * Create AutofillRepository asynchronously.
         * [변경 — Autofill Matching Layer plan] 기존 1-key 경로 — 인덱스 없음, 테스트/롤백 전용.
         */
        @Deprecated(
            message = "Use create(context, dbKey, indexKey) for production. Index DB required for suppression flow.",
            replaceWith = ReplaceWith("create(context, DatabaseKeyManager.getKey(context).encoded, DatabaseKeyManager.getIndexKey(context))")
        )
        @JvmStatic
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

    /**<|reserved_token_163698|>
     * Insert a new account for autofill
     */
    fun insertAccount(account: AutofillAccount): Long {
        return executor.submit<Long> {
            val db = dbHelper!!.getWritableDatabase()
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
            val existing = domainMatcher.findByUsernameAndPackage(dbHelper!!.getReadableDatabase(), account.username, account.packageNames.firstOrNull(), account.domain)
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
            val db = dbHelper!!.getWritableDatabase()
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
            val db = dbHelper!!.getWritableDatabase()
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
            domainMatcher.findMatchingAccounts(dbHelper!!.getReadableDatabase(), domain)
        }.get()
    }

    /**
     * Search accounts by username (partial match)
     */
    fun searchByUsername(query: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.searchByUsername(dbHelper!!.getReadableDatabase(), query)
        }.get()
    }

    /**
     * Find all accounts matching a package name (Android app)
     * Checks package_names JSON array
     */
    fun findByPackageName(packageName: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.findByPackageName(dbHelper!!.getReadableDatabase(), packageName)
        }.get()
    }

    /**
     * Find all accounts matching a domain (for web autofill)
     * Exact domain match only (subdomain matching handled by findMatchingAccounts)
     */
    fun findByDomain(domain: String): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.findByDomain(dbHelper!!.getReadableDatabase(), domain)
        }.get()
    }

    /**
     * Get all accounts (for sync/management)
     */
    fun getAllAccounts(): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.getAllAccounts(dbHelper!!.getReadableDatabase())
        }.get()
    }

    /**
     * Get favorite accounts
     */
    fun getFavoriteAccounts(): List<AutofillAccount> {
        return executor.submit<List<AutofillAccount>> {
            domainMatcher.getFavoriteAccounts(dbHelper!!.getReadableDatabase())
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

    /**<|reserved_token_163698|>
     * Get account by ID
     */
    fun getAccountById(id: Long): AutofillAccount? {
        return executor.submit<AutofillAccount?> {
            val db = dbHelper!!.getReadableDatabase()
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

    /**<|reserved_token_163698|>
     * Add package name to account by username (for packageName auto-learning during save)
     * Finds account by username and adds packageName if not already present
     */
    fun addPackageNameToAccountByUsername(username: String, packageName: String): Boolean {
        return executor.submit<Boolean> {
            val account = domainMatcher.findByUsername(dbHelper!!.getReadableDatabase(), username)
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
                val db = dbHelper!!.getWritableDatabase()
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

    /**<|reserved_token_163698|>
     * Sync accounts from React AND rebuild index table in a single atomic transaction.
     * This ensures the main DB and index DB are consistent - no window where
     * AutofillService could see synced accounts but empty index, or vice versa.
     *
     * @param accountsJson JSON array of accounts from React
     * @return Pair of (syncedCount, errorCount)
     */
    fun syncAndRebuildIndex(accountsJson: String): Pair<Int, Int> {
        return executor.submit<Pair<Int, Int>> {
            var syncedCount = 0
            var errorCount = 0
            val syncedAccounts = mutableListOf<AutofillAccount>()

            try {
                val jsonArray = JSONArray(accountsJson)
                val db = dbHelper!!.getWritableDatabase()
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
                                    syncedAccounts.add(autofillAccount.copy(id = id))
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

            // Index rebuild는 **새 스레드**에서 fire-and-forget.
            // 인덱스 DB의 mlock JNI block(200ms)이 UI 응답을 지연시키지 않도록 분리.
            // executor.submit을 쓰면 같은 큐에서 다시 mlock 발생 → UI 멈춤 재현.
            val capturedAccounts = syncedAccounts.toList()
            Thread {
                try {
                    rebuildIndexTable(capturedAccounts)
                } catch (e: Exception) {
                    Log.e(TAG, "Background index rebuild failed: ${e.message}", e)
                }
            }.apply {
                name = "IndexRebuildThread"
                isDaemon = true
                start()
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

    /**<|reserved_token_163698|>
     * Get total account count
     */
    fun getAccountCount(): Int {
        return executor.submit<Int> {
            val db = dbHelper!!.getReadableDatabase()
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
            val db = dbHelper!!.getWritableDatabase()
            db.delete(AutofillDatabaseHelper.TABLE_ACCOUNTS, null, null)
        }.get()
    }

    /**<|reserved_token_163698|>
     * Close the database helper and shutdown executor
     */
    fun close() {
        dbHelper?.close()
        indexDbHelper?.close()
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

    // ============================================================
    // [Autofill Matching Layer plan 2026-08-28] — Index DB API
    // ============================================================

    /**
     * 1차 필터링: 인덱스 DB에서 도메인/패키지 매칭.
     * - INDEX_KEY만 필요 (비인증 키) — 메인 DB_KEY 불필요, 인증 프롬프트 없음
     * - SQLCipher가 복호화한 평문 도메인/패키지 값으로 DomainMatcher.matchesDomain/matchesPackage 사용
     * - indexDbHelper=null인 경우(테스트/롤백) emptyList 반환 → 드롭다운 안 뜸
     */
    fun findMatchingAccountIdsByIndex(domain: String?, packageNames: List<String>): List<Long> {
        val helper = indexDbHelper ?: return emptyList()
        return executor.submit<List<Long>> {
            val indexDb = helper.getReadableDatabase()
            val cursor = indexDb.query(
                AutofillIndexDatabaseHelper.TABLE_INDEX,
                arrayOf(
                    AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID,
                    AutofillIndexDatabaseHelper.COLUMN_DOMAIN,
                    AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES
                ),
                null, null, null, null, null
            )
            val matchingIds = mutableListOf<Long>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    val accountId = c.getLong(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID))
                    val storedDomain = c.getString(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_DOMAIN)) ?: ""
                    val storedPkgJson = c.getString(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES)) ?: "[]"

                    if (domainMatcher.matchesDomain(storedDomain, domain) ||
                        domainMatcher.matchesPackage(storedPkgJson, packageNames)) {
                        matchingIds.add(accountId)
                    }
                }
            }
            Log.d(TAG, "Index matched ${matchingIds.size} account IDs for domain='$domain', packages=$packageNames")
            matchingIds
        }.get()
    }

    /**<|reserved_token_163698|>
     * 2단계: 매칭된 ID들로 메인 DB에서 전체 계정 조회 (기존 로직 재사용).
     * - DB_KEY 필요, 인증 캐시 만료 시 UserNotAuthenticatedException → 호출자가 catch.
     */
    fun getAccountsByIds(ids: List<Long>): List<AutofillAccount> {
        if (ids.isEmpty()) return emptyList()
        return executor.submit<List<AutofillAccount>> {
            val db = dbHelper!!.getReadableDatabase()
            val placeholders = ids.joinToString(",") { "?" }
            val cursor = db.rawQuery(
                "SELECT * FROM ${AutofillDatabaseHelper.TABLE_ACCOUNTS} WHERE ${AutofillDatabaseHelper.COLUMN_ID} IN ($placeholders)",
                ids.map { it.toString() }.toTypedArray()
            )
            val results = mutableListOf<AutofillAccount>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    accountMapper.fromCursor(c)?.let { results.add(it) }
                }
            }
            Log.d(TAG, "getAccountsByIds: requested=${ids.size}, returned=${results.size}")
            results
        }.get()
    }

    /**
     * 인덱스 테이블에 단일 entry 동기화 (CONFLICT_REPLACE).
     * indexDbHelper=null이면 no-op.
     */
    fun syncIndexTable(accountId: Long, account: AutofillAccount) {
        val helper = indexDbHelper ?: return
        executor.submit {
            val indexDb = helper.getWritableDatabase()
            val values = android.content.ContentValues().apply {
                put(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID, accountId)
                put(AutofillIndexDatabaseHelper.COLUMN_DOMAIN, account.domain ?: "")
                put(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES, account.packageNamesToJson() ?: "[]")
                put(AutofillIndexDatabaseHelper.COLUMN_UPDATED_AT, System.currentTimeMillis())
            }
            indexDb.insertWithOnConflict(
                AutofillIndexDatabaseHelper.TABLE_INDEX,
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE
            )
        }.get()
    }

    /**
     * 인덱스 테이블에서 accountId로 entry 삭제.
     * indexDbHelper=null이면 no-op.
     */
    fun deleteIndexEntry(accountId: Long) {
        val helper = indexDbHelper ?: return
        executor.submit {
            helper.getWritableDatabase().delete(
                AutofillIndexDatabaseHelper.TABLE_INDEX,
                "${AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID} = ?",
                arrayOf(accountId.toString())
            )
        }.get()
    }

    /**
     * 인덱스 테이블 전체 재구축 (Sync 시 호출).
     * - React가 source of truth, 메인 DB와 무관한 별도 트랜잭션.
     * - indexDbHelper=null이면 no-op.
     * - 호출자 스레드에서 직접 실행 (executor 우회) — fire-and-forget 패턴.
     */
    fun rebuildIndexTable(accounts: List<AutofillAccount>) {
        val helper = indexDbHelper ?: return
        val indexDb = helper.getWritableDatabase()
        indexDb.beginTransaction()
        try {
            indexDb.delete(AutofillIndexDatabaseHelper.TABLE_INDEX, null, null)
            for (account in accounts) {
                val values = android.content.ContentValues().apply {
                    put(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID, account.id)
                    put(AutofillIndexDatabaseHelper.COLUMN_DOMAIN, account.domain ?: "")
                    put(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES, account.packageNamesToJson() ?: "[]")
                    put(AutofillIndexDatabaseHelper.COLUMN_UPDATED_AT, System.currentTimeMillis())
                }
                indexDb.insert(AutofillIndexDatabaseHelper.TABLE_INDEX, null, values)
            }
            indexDb.setTransactionSuccessful()
            Log.d(TAG, "Index table rebuilt with ${accounts.size} entries")
        } finally {
            indexDb.endTransaction()
        }
    }
}