package com.kiyo.app.autofill.repository

import android.content.Context
import android.util.Log
import net.zetetic.database.sqlcipher.SQLiteDatabase

/**
 * [Autofill Matching Layer plan 2026-08-28]
 *
 * 독립된 인덱스용 SQLCipher DB 헬퍼.
 * - 메인 DB(kiyo_autofill.db)와 완전히 분리된 별도 파일 (kiyo_autofill_index.db)
 * - INDEX_KEY(비인증 Keystore 키)로 SQLCipher 암호화 → 사용자 인증 없이 접근 가능
 * - 메인 DB 스키마/데이터/트랜잭션과 무관 — 별도 라이프사이클
 * - 매칭에 필요한 메타데이터만 저장 (account_id, domain, package_names)
 * - 자격증명(username/password) 절대 저장하지 않음
 * - 기존 AutofillDatabaseHelper와 동일한 수동 DB 관리 패턴 사용
 *   (SQLiteOpenHelper 상속 안 함, ByteArray 키 직접 전달)
 *
 * 메모: SQLCipher 4.6.1에서 hook 사용은 JNI critical section 재진입 데드락 유발
 * (이슈 #48). 4-인자 시그니처로 단순화.
 */
class AutofillIndexDatabaseHelper(
    private val context: Context,
    private val encryptionKey: ByteArray
) {

    companion object {
        private const val DATABASE_NAME = "kiyo_autofill_index.db"
        private const val DATABASE_VERSION = 1
        private const val TAG = "AutofillIndexDatabaseHelper"

        const val TABLE_INDEX = "autofill_index"
        const val COLUMN_ID = "_id"
        const val COLUMN_ACCOUNT_ID = "account_id"           // 메인 DB id 참조용 (FK 아님, 단순 정수)
        const val COLUMN_DOMAIN = "domain"                   // SQLCipher가 암호화
        const val COLUMN_PACKAGE_NAMES = "package_names"     // SQLCipher가 암호화, JSON 배열 문자열
        const val COLUMN_UPDATED_AT = "updated_at"
    }

    private var database: SQLiteDatabase? = null

    /** Get readable database (opens with encryption key if not already open) */
    fun getReadableDatabase(): SQLiteDatabase {
        return getDatabase(SQLiteDatabase.OPEN_READONLY)
    }

    /** Get writable database (opens with encryption key if not already open) */
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

    /** Close the database */
    fun close() {
        database?.close()
        database = null
    }

    /** Create database schema */
    private fun onCreate(db: SQLiteDatabase) {
        val createTableSql = """
            CREATE TABLE $TABLE_INDEX (
                $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COLUMN_ACCOUNT_ID INTEGER NOT NULL,
                $COLUMN_DOMAIN TEXT NOT NULL DEFAULT '',
                $COLUMN_PACKAGE_NAMES TEXT NOT NULL DEFAULT '[]',
                $COLUMN_UPDATED_AT INTEGER NOT NULL,
                UNIQUE($COLUMN_ACCOUNT_ID)
            )
        """.trimIndent()

        db.execSQL(createTableSql)
        Log.d(TAG, "Independent index database created (SQLCipher + INDEX_KEY, non-auth)")
    }

    /** Upgrade database schema */
    private fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Upgrading index database from $oldVersion to $newVersion")
        // v1: 단일 버전 — 향후 v2 추가 시 별도 분기 작성.
        // 현재는 안전하게 drop & recreate (메인 DB와 달리 인덱스는 React sync로 재구축 가능)
        db.execSQL("DROP TABLE IF EXISTS $TABLE_INDEX")
        onCreate(db)
    }
}