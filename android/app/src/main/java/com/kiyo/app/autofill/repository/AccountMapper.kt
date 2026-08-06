package com.kiyo.app.autofill.repository

import android.database.Cursor
import android.util.Log
import com.kiyo.app.autofill.repository.AutofillRepository.AutofillAccount
import org.json.JSONArray
import org.json.JSONObject

/**
 * Maps React Account JSON to AutofillAccount.
 * Extracted from AutofillRepository to separate parsing logic.
 */
class AccountMapper {

    private val TAG = "AccountMapper"

    /**
     * Parse React Account JSON to AutofillAccount.
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
    fun parseReactAccount(json: JSONObject): AutofillAccount? {
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
    fun extractDomain(url: String): String? {
        try {
            val uri = android.net.Uri.parse(url)
            return uri.host
        } catch (e: Exception) {
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