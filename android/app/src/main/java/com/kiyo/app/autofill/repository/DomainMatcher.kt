package com.kiyo.app.autofill.repository

import android.database.Cursor
import android.util.Log
import com.kiyo.app.autofill.repository.AutofillRepository.AutofillAccount
import net.zetetic.database.sqlcipher.SQLiteDatabase as SQLCipherDatabase

/**
 * Handles domain matching logic for autofill accounts.
 * Extracted from AutofillRepository to separate subdomain matching logic.
 */
class DomainMatcher {

    private val TAG = "DomainMatcher"

    /**
     * Find matching accounts for autofill based on domain.
     * Supports exact domain match and subdomain matching (e.g., accounts.google.com -> google.com).
     */
    fun findMatchingAccounts(db: SQLCipherDatabase, domain: String?): List<AutofillAccount> {
        if (domain == null || domain.isEmpty()) {
            return emptyList()
        }

        val accounts = mutableListOf<AutofillAccount>()

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

        cursor.use { c ->
            while (c.moveToNext()) {
                accounts.add(AccountMapper().fromCursor(c))
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
                            accounts.add(AccountMapper().fromCursor(c))
                        }
                    }
                    if (accounts.isNotEmpty()) break
                }
            }
        }

        return accounts
    }

    /**
     * Find account by username and package name (for Android apps).
     * Checks packageNames JSON array for multiple package names.
     */
    fun findByUsernameAndPackage(db: SQLCipherDatabase, username: String, packageName: String?, domain: String?): AutofillAccount? {
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

        return cursor.use { c ->
            if (c.moveToFirst()) {
                AccountMapper().fromCursor(c)
            } else {
                null
            }
        }
    }

    /**
     * Find account by username only (for linking packageName to existing web account).
     * Returns the most recently updated account with this username.
     */
    fun findByUsername(db: SQLCipherDatabase, username: String): AutofillAccount? {
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

        return cursor.use { c ->
            if (c.moveToFirst()) {
                AccountMapper().fromCursor(c)
            } else {
                null
            }
        }
    }

    /**
     * Find all accounts matching a package name (Android app).
     * Checks package_names JSON array.
     */
    fun findByPackageName(db: SQLCipherDatabase, packageName: String): List<AutofillAccount> {
        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
            "${AutofillDatabaseHelper.COLUMN_PACKAGE_NAMES} LIKE ?",
            arrayOf("%\"$packageName\"%"),
            null,
            null,
            "${AutofillDatabaseHelper.COLUMN_FAVORITE} DESC, ${AutofillDatabaseHelper.COLUMN_UPDATED_AT} DESC"
        )

        return cursor.use { c ->
            val accounts = mutableListOf<AutofillAccount>()
            while (c.moveToNext()) {
                accounts.add(AccountMapper().fromCursor(c))
            }
            accounts
        }
    }

    /**
     * Find all accounts matching a domain (for web autofill).
     * Exact domain match only (subdomain matching handled by findMatchingAccounts).
     */
    fun findByDomain(db: SQLCipherDatabase, domain: String): List<AutofillAccount> {
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
                accounts.add(AccountMapper().fromCursor(c))
            }
            accounts
        }
    }

    /**
     * Search accounts by username (partial match).
     */
    fun searchByUsername(db: SQLCipherDatabase, query: String): List<AutofillAccount> {
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
                accounts.add(AccountMapper().fromCursor(c))
            }
            accounts
        }
    }

    /**
     * Get all accounts (for sync/management).
     */
    fun getAllAccounts(db: SQLCipherDatabase): List<AutofillAccount> {
        val cursor = db.query(
            AutofillDatabaseHelper.TABLE_ACCOUNTS,
            null,
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
                accounts.add(AccountMapper().fromCursor(c))
            }
            accounts
        }
    }

    /**
     * Get favorite accounts.
     */
    fun getFavoriteAccounts(db: SQLCipherDatabase): List<AutofillAccount> {
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
                accounts.add(AccountMapper().fromCursor(c))
            }
            accounts
        }
    }
}