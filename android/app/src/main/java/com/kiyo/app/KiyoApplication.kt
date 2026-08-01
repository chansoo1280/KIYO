package com.kiyo.app

import android.app.Application
import android.util.Log

class KiyoApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        try {
            System.loadLibrary("sqlcipher")
            Log.d("KiyoApplication", "SQLCipher loaded successfully")
        } catch (e: UnsatisfiedLinkError) {
            Log.e("KiyoApplication", "SQLCipher load failed", e)
        }
    }
}