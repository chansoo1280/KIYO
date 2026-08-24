package com.kiyo.app.securekey

import android.app.Activity
import android.content.Context
import android.util.Log
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "SecureKey")
class SecureKeyPlugin : Plugin() {

    companion object {
        private const val TAG = "SecureKeyPlugin"
    }

    private var biometricAuthHelper: BiometricAuthHelper? = null

    override fun load() {
        super.load()
        Log.d(TAG, "SecureKey plugin loaded")
    }

    private fun ensureBiometricHelper(): BiometricAuthHelper {
        return biometricAuthHelper ?: run {
            val activity = getActivity() as FragmentActivity
            val context = getContext() ?: throw IllegalStateException("Context is null")
            val helper = BiometricAuthHelperFactory.create(context, activity)
            biometricAuthHelper = helper
            helper
        }
    }

    @PluginMethod
    fun storeKey(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val vaultId = call.getString("vaultId") ?: return@launch call.reject("vaultId is required")
                val key = call.getString("key") ?: return@launch call.reject("key is required")

                val helper = ensureBiometricHelper()
                val result = helper.storeKey(vaultId, key).getOrThrow()

                call.resolve(JSObject().apply {
                    put("success", true)
                })
            } catch (e: BiometricAuthException) {
                Log.e(TAG, "storeKey biometric auth error: ${e.errorCode} - ${e.message}")
                call.reject("Biometric authentication failed: ${e.message}", e, JSObject().apply {
                    put("errorCode", e.errorCode)
                    put("biometricError", true)
                })
            } catch (e: Exception) {
                Log.e(TAG, "storeKey failed", e)
                call.reject("Failed to store key: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun unlockKeyWithBiometric(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val vaultId = call.getString("vaultId") ?: return@launch call.reject("vaultId is required")

                val helper = ensureBiometricHelper()
                val cryptoKeyBase64 = helper.unlockKeyWithBiometric(vaultId).getOrThrow()

                call.resolve(JSObject().apply {
                    put("key", cryptoKeyBase64)
                    put("success", true)
                })
            } catch (e: BiometricAuthException) {
                Log.e(TAG, "unlockKeyWithBiometric biometric auth error: ${e.errorCode} - ${e.message}")
                call.reject("Biometric authentication failed: ${e.message}", e, JSObject().apply {
                    put("errorCode", e.errorCode)
                    put("biometricError", true)
                })
            } catch (e: Exception) {
                Log.e(TAG, "unlockKeyWithBiometric failed", e)
                call.reject("Failed to unlock key: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun deleteKey(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val vaultId = call.getString("vaultId") ?: return@launch call.reject("vaultId is required")

                val helper = ensureBiometricHelper()
                helper.deleteKey(vaultId).getOrThrow()

                call.resolve(JSObject().apply {
                    put("success", true)
                })
            } catch (e: Exception) {
                Log.e(TAG, "deleteKey failed", e)
                call.reject("Failed to delete key: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun hasKey(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val vaultId = call.getString("vaultId") ?: return@launch call.reject("vaultId is required")

                val helper = ensureBiometricHelper()
                val exists = helper.hasKey(vaultId).getOrThrow()

                call.resolve(JSObject().apply {
                    put("exists", exists)
                })
            } catch (e: Exception) {
                Log.e(TAG, "hasKey failed", e)
                call.reject("Failed to check key: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun isBiometryAvailable(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val helper = ensureBiometricHelper()
                val availability = helper.isBiometryAvailable().getOrThrow()

                call.resolve(JSObject().apply {
                    put("available", availability.available)
                    put("type", availability.type)
                })
            } catch (e: Exception) {
                Log.e(TAG, "isBiometryAvailable failed", e)
                call.reject("Failed to check biometry: ${e.message}")
            }
        }
    }
}