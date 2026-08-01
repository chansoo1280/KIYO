package com.kiyo.app.security

import javax.crypto.SecretKey

/**
 * Interface for keystore operations to enable testing.
 */
interface KeystoreProvider {
    fun getOrCreateKey(): SecretKey
    fun encrypt(masterKey: SecretKey, plainKey: ByteArray): EncryptedKey
    fun decrypt(masterKey: SecretKey, encrypted: EncryptedKey): ByteArray
}