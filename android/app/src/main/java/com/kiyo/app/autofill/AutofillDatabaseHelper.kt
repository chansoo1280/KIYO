package com.kiyo.app.autofill

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log

/**
 * SQLite database helper for Android Autofill Service.
 * Stores minimal account information for autofill: username, password, title, packageName/domain.
 * This is separate from the main IndexedDB storage used by the React app.
 */
class AutofillDatabaseHelper(context: Context) : SQLiteOpenHelper(
    context,
    DATABASE_NAME,
    null,
    DATABASE_VERSION
) {

    companion object {
        private const val DATABASE_NAME = "kiyo_autofill.db"
        private const val DATABASE_VERSION = 3
        private const val TAG = "AutofillDatabaseHelper"

        // Table name
        const val TABLE_ACCOUNTS = "autofill_accounts"

        // Column names
        const val COLUMN_ID = "_id"
        const val COLUMN_USERNAME = "username"
        const val COLUMN_PASSWORD = "password"
        const val COLUMN_TITLE = "title"
        const val COLUMN_PACKAGE_NAME = "package_name"
        const val COLUMN_PACKAGE_NAMES = "package_names"  // JSON array for multiple package names
        const val COLUMN_APP_NAME = "app_name"
        const val COLUMN_DOMAIN = "domain"
        const val COLUMN_CREATED_AT = "created_at"
        const val COLUMN_UPDATED_AT = "updated_at"
        const val COLUMN_FAVORITE = "favorite"
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createTableSql = """
            CREATE TABLE $TABLE_ACCOUNTS (
                $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COLUMN_USERNAME TEXT NOT NULL,
                $COLUMN_PASSWORD TEXT NOT NULL,
                $COLUMN_TITLE TEXT,
                $COLUMN_PACKAGE_NAME TEXT,
                $COLUMN_PACKAGE_NAMES TEXT,  -- JSON array for multiple package names
                $COLUMN_APP_NAME TEXT,
                $COLUMN_DOMAIN TEXT,
                $COLUMN_CREATED_AT INTEGER NOT NULL,
                $COLUMN_UPDATED_AT INTEGER NOT NULL,
                $COLUMN_FAVORITE INTEGER DEFAULT 0
            )
        """.trimIndent()

        db.execSQL(createTableSql)

        // Create indexes for faster lookups
        db.execSQL("CREATE INDEX idx_autofill_package_name ON $TABLE_ACCOUNTS($COLUMN_PACKAGE_NAME)")
        db.execSQL("CREATE INDEX idx_autofill_package_names ON $TABLE_ACCOUNTS($COLUMN_PACKAGE_NAMES)")
        db.execSQL("CREATE INDEX idx_autofill_domain ON $TABLE_ACCOUNTS($COLUMN_DOMAIN)")
        db.execSQL("CREATE INDEX idx_autofill_username ON $TABLE_ACCOUNTS($COLUMN_USERNAME)")
        db.execSQL("CREATE INDEX idx_autofill_app_name ON $TABLE_ACCOUNTS($COLUMN_APP_NAME)")

        Log.d(TAG, "Autofill database created successfully")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Upgrading database from version $oldVersion to $newVersion")
        when (oldVersion) {
            1 -> {
                // Migration from version 1 to 2: Add app_name column
                Log.d(TAG, "Migrating from version 1 to 2: Adding app_name column")
                db.execSQL("ALTER TABLE $TABLE_ACCOUNTS ADD COLUMN $COLUMN_APP_NAME TEXT")
                // Create index for app_name for faster lookups
                db.execSQL("CREATE INDEX IF NOT EXISTS idx_autofill_app_name ON $TABLE_ACCOUNTS($COLUMN_APP_NAME)")
            }
            2 -> {
                // Migration from version 2 to 3: Add package_names column (JSON array for multiple package names)
                Log.d(TAG, "Migrating from version 2 to 3: Adding package_names column")
                db.execSQL("ALTER TABLE $TABLE_ACCOUNTS ADD COLUMN $COLUMN_PACKAGE_NAMES TEXT")
                // Create index for package_names
                db.execSQL("CREATE INDEX IF NOT EXISTS idx_autofill_package_names ON $TABLE_ACCOUNTS($COLUMN_PACKAGE_NAMES)")
                // Migrate existing package_name to package_names JSON array
                migratePackageNames(db)
            }
        }
    }

    /**
     * Migrate existing package_name column to package_names JSON array
     */
    private fun migratePackageNames(db: SQLiteDatabase) {
        Log.d(TAG, "Migrating existing package_name to package_names JSON array")
        val cursor = db.rawQuery(
            "SELECT $COLUMN_ID, $COLUMN_PACKAGE_NAME FROM $TABLE_ACCOUNTS WHERE $COLUMN_PACKAGE_NAME IS NOT NULL AND $COLUMN_PACKAGE_NAME != ''",
            null
        )
        try {
            val updates = mutableListOf<Pair<Long, String>>()
            while (cursor.moveToNext()) {
                val id = cursor.getLong(0)
                val packageName = cursor.getString(1)
                if (packageName != null && packageName.isNotEmpty()) {
                    // Create JSON array with single package name
                    val jsonArray = org.json.JSONArray().put(packageName)
                    updates.add(Pair(id, jsonArray.toString()))
                }
            }
            cursor.close()

            // Batch update
            db.beginTransaction()
            try {
                for ((id, jsonArray) in updates) {
                    val values = android.content.ContentValues().apply {
                        put(COLUMN_PACKAGE_NAMES, jsonArray)
                    }
                    db.update(TABLE_ACCOUNTS, values, "$COLUMN_ID = ?", arrayOf(id.toString()))
                }
                db.setTransactionSuccessful()
                Log.d(TAG, "Migrated ${updates.size} accounts to package_names JSON array")
            } finally {
                db.endTransaction()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error migrating package names", e)
            cursor.close()
        }
    }

    override fun onDowngrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Downgrading database from version $oldVersion to $newVersion - dropping tables")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_ACCOUNTS")
        onCreate(db)
    }
}
