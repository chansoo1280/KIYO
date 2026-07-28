package com.kiyo.app.security

import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

object DatabaseKeyGenerator {

    private const val KEY_SIZE = 256

    fun generate(): SecretKey {

        val keyGenerator =
            KeyGenerator.getInstance("AES")

        keyGenerator.init(KEY_SIZE)

        return keyGenerator.generateKey()
    }
}