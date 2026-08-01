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
    private var sessionIsLock: Boolean? = null

    @Synchronized
    fun save(key: String, isLock: Boolean) {
        sessionKey = key
        sessionIsLock = isLock
        Log.d(TAG, "sessionKey, sessionIsLock :: ${sessionKey}, ${isLock}")
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
    fun isLocked(): Boolean {
        return sessionIsLock == true
    }

    @Synchronized
    fun clear() {
        sessionKey = null
        sessionIsLock = null
        Log.d(TAG, "clear session")
    }
}