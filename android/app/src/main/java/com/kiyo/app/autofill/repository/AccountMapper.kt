package com.kiyo.app.autofill.repository

import android.database.Cursor
import android.util.Log
import com.kiyo.app.autofill.repository.AutofillRepository.AutofillAccount
import org.json.JSONArray
import org.json.JSONObject

/**
 * Maps React Account JSON to AutofillAccount.
 */
class AccountMapper {

    private val TAG = "AccountMapper"

    /**
     * Extract package name from fields array
     */
    private fun findPackageNameFromFields(fieldsArray: JSONArray?): String? {
        if (fieldsArray == null) return null
        for (i in 0 until fieldsArray.length()) {
            val field = fieldsArray.getJSONObject(i)
            val label = field.optString("label", "").lowercase()
            val value = field.optString("value", "")
            if (label in setOf("package", "package name", "app", "application") && value.isNotEmpty()) {
                return value
            }
        }
        return null
    }

    /**
     * Extract domain from URL
     */
    fun extractDomain(url: String): String? {
        try {
            val uri = android.net.Uri.parse(url)
            return uri.host
        } catch (e: Exception) {
            return null
        }
    }

    /**
     * Parse React Account JSON to AutofillAccount.
     */
    fun parseReactAccount(json: JSONObject): AutofillAccount? {
        try {
            // Read packageNames array if present
            val packageNamesFromArray = if (json.has("packageNames")) {
                val arr = json.getJSONArray("packageNames")
                val list = mutableListOf<String>()
                for (i in 0 until arr.length()) {
                    val pkg = arr.optString(i)
                    if (pkg.isNotEmpty()) list.add(pkg)
                }
                list
            } else {
                emptyList<String>()
            }

            // Extract single packageName
            val singlePackageName = json.optString("packageName").takeIf { it.isNotEmpty() }
                ?: findPackageNameFromFields(json.optJSONArray("fields"))

            // Combine packageNames
            val combinedPackageNames = mutableListOf<String>()
            if (singlePackageName != null && singlePackageName.isNotEmpty()) {
                combinedPackageNames.add(singlePackageName)
            }
            combinedPackageNames.addAll(packageNamesFromArray)

            // Extract domain
            val domainOpt = json.optString("domain").takeIf { it.isNotEmpty() }
            val finalDomain = domainOpt ?: json.optString("websiteUrl").takeIf { it.isNotEmpty() }?.let { extractDomain(it) }

            // Extract username and password
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
                        "email", "text" -> if (username.isEmpty()) username = value
                    }
                }
            }

            // Fallback: if no username found, use first text field
            if (username.isEmpty()) {
                json.optJSONArray("fields")?.let { fields ->
                    for (i in 0 until fields.length()) {
                        val field = fields.getJSONObject(i)
                        val type = field.optString("type", "")
                        val value = field.optString("value", "")
                        if (type == "text" && value.isNotEmpty()) {
                            username = value
                            return@let
                        }
                    }
                }
            }

            // Skip if no username or password
            if (username.isEmpty() || password.isEmpty()) {
                val skippedTitle = json.optString("title", "unknown")
                Log.w(TAG, "Skipping account with missing username/password: $skippedTitle")
                return null
            }

            val appName = json.optString("appName").takeIf { it.isNotEmpty() }
            val title = json.optString("title").takeIf { it.isNotEmpty() }
            val favorite = json.optBoolean("favorite", false)
            val createdAt = json.optLong("createdAt", System.currentTimeMillis())
            val updatedAt = json.optLong("updatedAt", System.currentTimeMillis())

            return AutofillAccount(
                username = username,
                password = password,
                title = title,
                packageNames = combinedPackageNames,
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
     * Create AutofillAccount from database cursor (parses packageNames JSON)
     */
    fun fromCursor(cursor: Cursor): AutofillAccount {
        // Password is stored in plaintext since DB is encrypted via SQLCipher
        val password = cursor.getString(cursor.getColumnIndexOrThrow(AutofillDatabaseHelper.COLUMN_PASSWORD))

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