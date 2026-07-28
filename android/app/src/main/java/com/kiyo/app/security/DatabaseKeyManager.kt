package com.kiyo.app.security

import android.content.Context
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec


private val Context.securityDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "kiyo_security_prefs"
)


object DatabaseKeyManager {

    private val DB_KEY = stringPreferencesKey("db_encryption_key")


    suspend fun getKey(context: Context): SecretKey {

        val prefs = context.securityDataStore.data.first()

        val savedKey = prefs[DB_KEY]

        if (savedKey != null) {
            return decodeKey(savedKey)
        }


        val newKey = DatabaseKeyGenerator.generate()

        val encoded = Base64.encodeToString(
            newKey.encoded,
            Base64.NO_WRAP
        )


        context.securityDataStore.edit { preferences ->
            preferences[DB_KEY] = encoded
        }


        return newKey
    }


    private fun decodeKey(base64: String): SecretKey {
        val bytes = Base64.decode(
            base64,
            Base64.NO_WRAP
        )

        return SecretKeySpec(
            bytes,
            "AES"
        )
    }
}