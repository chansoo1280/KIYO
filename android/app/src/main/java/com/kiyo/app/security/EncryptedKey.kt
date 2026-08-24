package com.kiyo.app.security

import android.util.Base64
import org.json.JSONException
import org.json.JSONObject

/**
 * Encrypted key container with IV and ciphertext (includes GCM tag).
 * Stored in DataStore as JSON.
 */
data class EncryptedKey(
    val iv: ByteArray,
    val ciphertext: ByteArray
) {
    companion object {
        private const val VERSION = 1
        private const val KEY_VERSION = "version"
        private const val KEY_IV = "iv"
        private const val KEY_CIPHERTEXT = "ciphertext"

        /**
         * Serialize to JSON string for DataStore storage.
         */
        fun toJson(encrypted: EncryptedKey): String {
            val obj = JSONObject()
            obj.put(KEY_VERSION, VERSION)
            obj.put(KEY_IV, Base64.encodeToString(encrypted.iv, Base64.NO_WRAP))
            obj.put(KEY_CIPHERTEXT, Base64.encodeToString(encrypted.ciphertext, Base64.NO_WRAP))
            return obj.toString()
        }

        /**
         * Deserialize from JSON string.
         */
        @Throws(JSONException::class)
        fun fromJson(json: String): EncryptedKey {
            val obj = JSONObject(json)
            val version = obj.getInt(KEY_VERSION)
            if (version != VERSION) {
                throw IllegalArgumentException("Unsupported EncryptedKey version: $version")
            }
            val iv = Base64.decode(obj.getString(KEY_IV), Base64.NO_WRAP)
            val ciphertext = Base64.decode(obj.getString(KEY_CIPHERTEXT), Base64.NO_WRAP)
            return EncryptedKey(iv, ciphertext)
        }
    }
}