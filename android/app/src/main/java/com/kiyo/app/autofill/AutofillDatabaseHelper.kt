package com.kiyo.app.autofill

import android.content.Context
import android.util.Log
import net.zetetic.database.sqlcipher.SQLiteDatabase

/**
 * SQLCipher-based database helper for Android Autofill Service.
 * Uses AES-256 encryption via SQLCipher.
 * Database key is provided externally (from DatabaseKeyManager).
 */
class AutofillDatabaseHelper(
    private val context: Context,
    private val encryptionKey: ByteArray
) {

    companion object {
        private const val DATABASE_NAME = "kiyo_autofill.db"
        private const val DATABASE_VERSION = 6 // Incremented for encryption migration
        private const val TAG = "AutofillDatabaseHelper"

        // Table name
        const val TABLE_ACCOUNTS = "autofill_accounts"

        // Column names
        const val COLUMN_ID = "_id"
        const val COLUMN_USERNAME = "username"
        const val COLUMN_PASSWORD = "password"
        const val COLUMN_TITLE = "title"
        const val COLUMN_PACKAGE_NAMES = "package_names"
        const val COLUMN_APP_NAME = "app_name"
        const val COLUMN_DOMAIN = "domain"
        const val COLUMN_CREATED_AT = "created_at"
        const val COLUMN_UPDATED_AT = "updated_at"
        const val COLUMN_FAVORITE = "favorite"
    }

    private var database: SQLiteDatabase? = null

    /**
     * Get readable database (opens with encryption key if not already open)
     */
    fun getReadableDatabase(): SQLiteDatabase {
        return getDatabase(SQLiteDatabase.OPEN_READONLY)
    }

    /**
     * Get writable database (opens with encryption key if not already open)
     */
    fun getWritableDatabase(): SQLiteDatabase {
        return getDatabase(SQLiteDatabase.OPEN_READWRITE)
    }

    private fun getDatabase(flags: Int): SQLiteDatabase {
        val db = database
        if (db != null && db.isOpen) {
            return db
        }

        val dbFile = context.getDatabasePath(DATABASE_NAME)
        dbFile.parentFile?.mkdirs()

        val newDb = SQLiteDatabase.openOrCreateDatabase(
            dbFile,
            encryptionKey,
            null,
            null
        )

        database = newDb

        val cursor = newDb.rawQuery("PRAGMA user_version", null)

        var version = 0

        if (cursor.moveToFirst()) {
            version = cursor.getInt(0)
        }

        cursor.close()

        when {
            version == 0 -> {
                // First creation
                onCreate(newDb)
                newDb.execSQL("PRAGMA user_version = $DATABASE_VERSION")
            }

            version < DATABASE_VERSION -> {
                onUpgrade(newDb, version, DATABASE_VERSION)
                newDb.execSQL("PRAGMA user_version = $DATABASE_VERSION")
            }
        }

        return newDb
    }

    /**
     * Close the database
     */
    fun close() {
        database?.close()
        database = null
    }

    /**
     * Create database schema
     */
    private fun onCreate(db: SQLiteDatabase) {
        val createTableSql = """
            CREATE TABLE $TABLE_ACCOUNTS (
                $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COLUMN_USERNAME TEXT NOT NULL,
                $COLUMN_PASSWORD TEXT NOT NULL,
                $COLUMN_TITLE TEXT,
                $COLUMN_PACKAGE_NAMES TEXT,
                $COLUMN_APP_NAME TEXT,
                $COLUMN_DOMAIN TEXT,
                $COLUMN_CREATED_AT INTEGER NOT NULL,
                $COLUMN_UPDATED_AT INTEGER NOT NULL,
                $COLUMN_FAVORITE INTEGER DEFAULT 0
            )
        """.trimIndent()

        db.execSQL(createTableSql)

        // Create indexes for faster lookups
        db.execSQL("CREATE INDEX idx_autofill_package_names ON $TABLE_ACCOUNTS($COLUMN_PACKAGE_NAMES)")
        db.execSQL("CREATE INDEX idx_autofill_domain ON $TABLE_ACCOUNTS($COLUMN_DOMAIN)")
        db.execSQL("CREATE INDEX idx_autofill_username ON $TABLE_ACCOUNTS($COLUMN_USERNAME)")
        db.execSQL("CREATE INDEX idx_autofill_app_name ON $TABLE_ACCOUNTS($COLUMN_APP_NAME)")

        Log.d(TAG, "Autofill database created successfully (encrypted with SQLCipher)")
    }

    /**
     * Upgrade database schema
     */
    private fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Upgrading database from version $oldVersion to $newVersion")

        // For autofill DB (cache synced from React), safe to drop and recreate
        if (oldVersion < 6) {
            // Version 6: Migration to encrypted database - drop and recreate
            Log.w(TAG, "Migrating to encrypted database - dropping and recreating table")
            db.execSQL("DROP TABLE IF EXISTS $TABLE_ACCOUNTS")
            onCreate(db)
        }
    }

    /**
     * Downgrade database (drop and recreate)
     */
    fun onDowngrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Downgrading database from version $oldVersion to $newVersion")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_ACCOUNTS")
        onCreate(db)
    }
}
