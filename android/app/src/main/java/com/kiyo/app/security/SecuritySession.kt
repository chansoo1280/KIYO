package com.kiyo.app.security
import android.util.Log

/**
 * In-memory security session.
 *
 * - Process lifetime only
 * - Not persisted to disk
 * - Cleared automatically when app process is killed
 */
object SecuritySession {
    private val TAG = "KiyoAutofillService"

    @Volatile
    private var sessionKey: String? = null
    private var sessionIsEncrypted: Boolean? = null

    @Synchronized
    fun save(key: String?, isEncrypted: Boolean) {
        sessionKey = key
        sessionIsEncrypted = isEncrypted
        Log.d(TAG, "sessionKey, sessionIsEncrypted :: ${sessionKey}, ${isEncrypted}")
    }

    @Synchronized
    fun get(): String? {
        return sessionKey
    }

    @Synchronized
    fun hasSession(): Boolean {
        return sessionKey != null
    }

    @Synchronized
    fun isEncrypted(): Boolean {
        return sessionIsEncrypted == true
    }

    @Synchronized
    fun clear() {
        sessionKey = null
        sessionIsEncrypted = null
        Log.d(TAG, "clear session")
    }
}