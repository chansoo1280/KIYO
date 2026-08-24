package com.kiyo.app.testutil

import android.content.Context
import android.util.Log
import com.kiyo.app.security.DatabaseKeyManager
import com.kiyo.app.security.KeystoreManager
import com.kiyo.app.securekey.SecureKeyManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

/**
 * Test utilities for initializing KIYO security components in a clean state.
 * This ONLY handles synchronous cleanup of existing test data.
 * 
 * Actual authentication (PIN/biometric) is performed by the test cases
 * through the app's UI (BiometricPrompt, PIN entry, etc.).
 * 
 * Call initializeCleanEnvironment() in @Before methods.
 */
object TestSecurityInitializer {

    private const val TAG = "TestSecurityInitializer"
    private const val AUTO_FILL_DB_NAME = "kiyo_autofill.db"

    /** 테스트 정리 대상 autofill 마스터 키 alias 목록 (레거시 + 인덱스 alias 전체) */
    private val AUTOFILL_KEY_ALIASES =
        listOf(KeystoreManager.LEGACY_KEY_ALIAS) + (1..64).map { "kiyo_master_key_$it" }

    /**
     * Initialize a clean test environment (synchronous cleanup only):
     * 1. Delete Keystore master key (autofill: kiyo_master_key) - ONLY if recreate=true
     * 2. Delete Keystore master key (biometric: kiyo_secure_master_key) - ONLY if recreate=true
     * 3. Delete DataStore encrypted DB_KEY
     * 4. Delete SQLCipher database file (kiyo_autofill.db)
     * 5. Clear in-memory caches
     *
     * This does NOT perform authentication. Tests must authenticate
     * via the app UI (BiometricPrompt, PIN entry) before using keys.
     */
    fun initializeCleanEnvironment(context: Context, recreateKeystoreKeys: Boolean = true): Boolean {
        Log.d(TAG, "Initializing clean test environment... (recreateKeystoreKeys=$recreateKeystoreKeys)")

        var success = true

        // 1. Delete Keystore master keys (autofill: legacy + indexed aliases) - only if recreate
        if (recreateKeystoreKeys) {
            for (alias in AUTOFILL_KEY_ALIASES) {
                try {
                    if (KeystoreManager.deleteKey(alias)) {
                        Log.d(TAG, "Keystore master key (autofill) deleted: $alias")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to delete Keystore master key (autofill): $alias", e)
                    success = false
                }
            }

            // 2. Delete Keystore master key (biometric/securekey) - only if recreate
            try {
                val secureKeyDeleted = SecureKeyManager.deleteKey()
                if (secureKeyDeleted) {
                    Log.d(TAG, "Keystore master key (securekey) deleted")
                } else {
                    Log.d(TAG, "No Keystore master key (securekey) to delete")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to delete Keystore master key (securekey)", e)
                success = false
            }
        } else {
            Log.d(TAG, "Keeping existing Keystore keys (recreateKeystoreKeys=false)")
        }

        // 3. (in-memory key cache no longer exists in KeystoreManager - nothing to clear)
        if (recreateKeystoreKeys) {
            SecureKeyManager.clearCache()
        } else {
            Log.d(TAG, "Keeping Keystore caches (recreateKeystoreKeys=false)")
        }

        // 4. Delete DataStore encrypted DB_KEY (SYNCHRONOUS)
        try {
            runBlocking(Dispatchers.IO) {
                DatabaseKeyManager.deleteKey(context)
            }
            Log.d(TAG, "DataStore encrypted DB_KEY deleted")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete DataStore DB_KEY", e)
            success = false
        }

        // 5. Delete SQLCipher database file
        try {
            val dbFile = context.getDatabasePath(AUTO_FILL_DB_NAME)
            if (dbFile.exists()) {
                val deleted = dbFile.delete()
                if (deleted) {
                    Log.d(TAG, "SQLCipher database file deleted: $AUTO_FILL_DB_NAME")
                } else {
                    Log.w(TAG, "Failed to delete SQLCipher database file: $AUTO_FILL_DB_NAME")
                    success = false
                }
            } else {
                Log.d(TAG, "No SQLCipher database file to delete")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete SQLCipher database file", e)
            success = false
        }

        // 6. Verify clean state
        val hasAutofillKeystoreKey = AUTOFILL_KEY_ALIASES.any { KeystoreManager.hasKey(it) }
        val hasSecureKeystoreKey = SecureKeyManager.hasKey()
        Log.d(TAG, "Clean init complete - Keystore autofill has key: $hasAutofillKeystoreKey, securekey has key: $hasSecureKeystoreKey, success: $success")

        return success
    }

    /**
     * Check current test environment state (for debugging).
     */
    fun logEnvironmentState(context: Context) {
        Log.d(TAG, "=== Test Environment State ===")
        Log.d(TAG, "Keystore autofill has master key: ${AUTOFILL_KEY_ALIASES.any { KeystoreManager.hasKey(it) }}")
        Log.d(TAG, "Keystore securekey has master key: ${SecureKeyManager.hasKey()}")
        
        runBlocking(Dispatchers.IO) {
            val hasDbKey = DatabaseKeyManager.hasKey(context)
            Log.d(TAG, "DataStore has encrypted DB_KEY: $hasDbKey")
        }
    }
}