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
         * Supports exact domain match, subdomain matching (e.g., accounts.google.com -> google.com),
         * and wildcard subdomain matching (e.g., *.example.com matches api.example.com).
         */
        fun findMatchingAccounts(db: SQLCipherDatabase, domain: String?): List<AutofillAccount> {
            if (domain == null || domain.isEmpty()) {
                return emptyList()
            }

            // Normalize domain: lowercase, strip protocol, www., port, path
            val normalizedDomain = normalizeDomain(domain)

            // Query all accounts and filter in memory (handles wildcard + parent domain matching)
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
                    val account = AccountMapper().fromCursor(c) ?: continue
                    val accountDomain = account.domain ?: ""

                    // Check if account's domain matches the normalized domain
                    if (matchesDomain(normalizedDomain, accountDomain)) {
                        accounts.add(account)
                    }
                }
                accounts
            }
        }

        /**
         * Checks if a normalized domain matches an account's stored domain pattern.
         * Supports exact match, wildcard (*.example.com), and parent domain matching.
         */
        private fun matchesDomain(normalizedDomain: String, accountDomain: String): Boolean {
            // Normalize the account's stored domain for comparison
            val normalizedAccountDomain = normalizeDomain(accountDomain)
            
            // Exact match
            if (normalizedAccountDomain == normalizedDomain) {
                return true
            }
            
            // Wildcard match: *.example.com matches api.example.com, example.com
            if (normalizedAccountDomain.startsWith("*.")) {
                val baseDomain = normalizedAccountDomain.removePrefix("*.")
                return normalizedDomain == baseDomain || normalizedDomain.endsWith(".$baseDomain")
            }
            
            // Parent domain match: google.com matches accounts.google.com
            // (but only if account domain is the parent, not the child)
            val accountParts = normalizedAccountDomain.split(".")
            val queryParts = normalizedDomain.split(".")
            
            if (queryParts.size > accountParts.size && accountParts.size >= 2) {
                // Check if account domain is a suffix of query domain
                val querySuffix = queryParts.subList(queryParts.size - accountParts.size, queryParts.size).joinToString(".")
                return querySuffix == normalizedAccountDomain
            }
            
            return false
        }

        /**
         * Normalizes a domain for matching: converts to lowercase, strips protocol, www. prefix, port, and path.
         *
         * @param domain The domain or URL to normalize
         * @return The normalized domain
         */
        private fun normalizeDomain(domain: String): String {
            var normalized = domain.lowercase()
            
            // Strip protocol (http://, https://)
            normalized = normalized
                .removePrefix("https://")
                .removePrefix("http://")
            
            // Strip www. prefix
            if (normalized.startsWith("www.")) {
                normalized = normalized.substring(4)
            }
            
            // Strip path and query (everything after first /)
            val slashIndex = normalized.indexOf('/')
            if (slashIndex != -1) {
                normalized = normalized.substring(0, slashIndex)
            }
            
            // Strip port (everything after :)
            val colonIndex = normalized.indexOf(':')
            if (colonIndex != -1) {
                normalized = normalized.substring(0, colonIndex)
            }
            
            return normalized
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
             * Supports exact package name match and prefix match for app families
             * (e.g., com.example.app matches com.example.app and com.example.app.beta).
             */
            fun findByPackageName(db: SQLCipherDatabase, packageName: String): List<AutofillAccount> {
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
                        val account = AccountMapper().fromCursor(c) ?: continue
                        // account.packageNames is already a List<String> (parsed from JSON by AccountMapper)
                        val packageList = account.packageNames
                        // Check if any package in the account's packageList is equal to the queried packageName
                        // or is a prefix of it (with a dot)
                        val matches = packageList.any { accountPackage ->
                            packageName.equals(accountPackage) || packageName.startsWith("$accountPackage.")
                        }
                        if (matches) {
                            accounts.add(account)
                        }
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
                        val account = AccountMapper().fromCursor(c) ?: continue
                        accounts.add(account)
                    }
                    accounts
                }
            }

            /**
                 * Find the best matching account based on domain and package names with scoring.
                 * Returns the account with the highest confidence score.
                 */
                fun findBestMatch(db: SQLCipherDatabase, domain: String?, packageNames: List<String>?): AutofillAccount? {
                    if (domain == null && (packageNames == null || packageNames.isEmpty())) {
                        return null
                    }

                    val candidates = mutableListOf<Pair<AutofillAccount, Int>>()

                    // Check web domain matches
                    domain?.let { normalizedDomain ->
                        val domainAccounts = findMatchingAccounts(db, normalizedDomain)
                        for (account in domainAccounts) {
                            // Score: 100 for exact domain match, 50 for wildcard/subdomain match
                            val score = if (account.domain.equals(normalizedDomain, ignoreCase = true)) 100 else 50
                            candidates.add(account to score)
                        }
                    }

                    // Check package name matches
                    packageNames?.let { pkgList ->
                                            for (packageName in pkgList) {
                                                val packageAccounts = findByPackageName(db, packageName)
                                                for (account in packageAccounts) {
                                                    // Score: 80 for exact package match, 60 for prefix match (app family), 40 for related
                                                    val packageNames = account.packageNames
                                                    val score = when {
                                                        packageNames.contains(packageName) -> 80
                                                        packageNames.any { packageName.startsWith("$it.") } -> 60
                                                        else -> 40
                                                    }
                                                    candidates.add(account to score)
                                                }
                                            }
                                        }

                    if (candidates.isEmpty()) {
                        return null
                    }

                    // Return the account with the highest score
                    // If tie, prefer the one that appeared first (maintains existing order preference)
                    return candidates.maxByOrNull { it.second }?.first
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
                val account = AccountMapper().fromCursor(c) ?: continue
                accounts.add(account)
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
                val account = AccountMapper().fromCursor(c) ?: continue
                accounts.add(account)
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
                val account = AccountMapper().fromCursor(c) ?: continue
                accounts.add(account)
            }
            accounts
        }
    }
}