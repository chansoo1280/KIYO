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
        private const val DATABASE_VERSION = 1
        private const val TAG = "AutofillDatabaseHelper"

        // Table name
        const val TABLE_ACCOUNTS = "autofill_accounts"

        // Column names
        const val COLUMN_ID = "_id"
        const val COLUMN_USERNAME = "username"
        const val COLUMN_PASSWORD = "password"
        const val COLUMN_TITLE = "title"
        const val COLUMN_PACKAGE_NAME = "package_name"
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
                $COLUMN_DOMAIN TEXT,
                $COLUMN_CREATED_AT INTEGER NOT NULL,
                $COLUMN_UPDATED_AT INTEGER NOT NULL,
                $COLUMN_FAVORITE INTEGER DEFAULT 0
            )
        """.trimIndent()

        db.execSQL(createTableSql)

        // Create indexes for faster lookups
        db.execSQL("CREATE INDEX idx_autofill_package_name ON $TABLE_ACCOUNTS($COLUMN_PACKAGE_NAME)")
        db.execSQL("CREATE INDEX idx_autofill_domain ON $TABLE_ACCOUNTS($COLUMN_DOMAIN)")
        db.execSQL("CREATE INDEX idx_autofill_username ON $TABLE_ACCOUNTS($COLUMN_USERNAME)")

        Log.d(TAG, "Autofill database created successfully")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Upgrading database from version $oldVersion to $newVersion")
        // For future migrations
        when (oldVersion) {
            1 -> {
                // Future migrations go here
            }
        }
    }

    override fun onDowngrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Downgrading database from version $oldVersion to $newVersion - dropping tables")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_ACCOUNTS")
        onCreate(db)
    }
}