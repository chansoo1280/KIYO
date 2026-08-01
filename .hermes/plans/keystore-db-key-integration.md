# Android Keystore + DatabaseKeyManager Integration Plan

## Goal
Wrap the SQLCipher database encryption key (DB_KEY) with an Android Keystore-backed master key (`kiyo_master_key`), so the DB_KEY is never stored in plaintext in DataStore.

## Architecture

```
DatabaseKeyManager
    |
    +-- KeystoreManager (new)
    |       |
    |       +-- getOrCreateKey(): SecretKey
    |       +-- encrypt(plainKey: ByteArray): EncryptedKey
    |       +-- decrypt(encrypted: EncryptedKey): ByteArray
    |
    +-- DataStore (kiyo_security_prefs)
    |       |
    |       +-- db_encrypted_key: String (JSON)
    |
    +-- DatabaseKeyGenerator (existing)
            |
            +-- generate(): SecretKey
```

## Data Structures

### EncryptedKey (new file: `EncryptedKey.kt`)
```kotlin
data class EncryptedKey(
    val iv: ByteArray,
    val ciphertext: ByteArray
) {
    companion object {
        private const val VERSION = 1
        
        fun toJson(encrypted: EncryptedKey): String
        fun fromJson(json: String): EncryptedKey
    }
}
```

**JSON format stored in DataStore:**
```json
{
  "version": 1,
  "iv": "base64_encoded_iv",
  "ciphertext": "base64_encoded_ciphertext_with_gcm_tag"
}
```

### KeystoreManager (new file: `KeystoreManager.kt`)
```kotlin
object KeystoreManager {
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "kiyo_master_key"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val KEY_SIZE = 256

    fun getOrCreateKey(): SecretKey
    fun encrypt(plainKey: ByteArray): EncryptedKey
    fun decrypt(encrypted: EncryptedKey): ByteArray
}
```

**KeyGenParameterSpec (no StrongBox, no biometric):**
```kotlin
KeyGenParameterSpec.Builder(KEY_ALIAS, 
    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
    .setKeySize(KEY_SIZE)
    .setUserAuthenticationRequired(false)
    .build()
```

### DatabaseKeyManager (modify existing)
```kotlin
object DatabaseKeyManager {
    private val Context.securityDataStore: DataStore<Preferences> by preferencesDataStore(
        name = "kiyo_security_prefs"
    )
    private val DB_ENCRYPTED_KEY = stringPreferencesKey("db_encrypted_key")

    suspend fun getKey(context: Context): SecretKey {
        val prefs = context.securityDataStore.data.first()
        val json = prefs[DB_ENCRYPTED_KEY]
        val masterKey = KeystoreManager.getOrCreateKey()

        return if (json != null) {
            val encrypted = EncryptedKey.fromJson(json)
            val plainBytes = KeystoreManager.decrypt(masterKey, encrypted)
            SecretKeySpec(plainBytes, "AES")
        } else {
            val newKey = DatabaseKeyGenerator.generate()
            val encrypted = KeystoreManager.encrypt(masterKey, newKey.encoded)
            val jsonOut = EncryptedKey.toJson(encrypted)
            context.securityDataStore.edit { preferences ->
                preferences[DB_ENCRYPTED_KEY] = jsonOut
            }
            newKey
        }
    }
}
```

## Call Flow (unchanged)

```
KiyoAutofillService.onFillRequest()
         │
         ▼
CoroutineScope(Dispatchers.IO).launch {  ← existing
         │
         ▼
DatabaseKeyManager.getKey(context)  ← suspend
         │
         ├─▶ DataStore read JSON
         ├─▶ KeystoreManager.getOrCreateKey() → master key
         ├─▶ KeystoreManager.decrypt() → plain DB_KEY
         │
         ▼
AutofillDatabaseHelper(context, dbKey.encoded)
         │
         ▼
SQLiteDatabase.openOrCreateDatabase(dbFile, encryptionKey, ...)
         │
         ▼
SQLCipher DB opened (encrypted)
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `android/app/src/main/java/com/kiyo/app/security/EncryptedKey.kt` | Create new |
| `android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt` | Create new |
| `android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt` | Modify |
| `android/app/src/main/java/com/kiyo/app/security/DatabaseKeyGenerator.kt` | Keep as-is |

## Test Strategy

### Unit Tests (JUnit + MockK)
1. **EncryptedKey JSON serialization**
   - `toJson` / `fromJson` round-trip preserves data
   - Version field present

2. **KeystoreManager**
   - `getOrCreateKey()` returns same key on repeated calls
   - `encrypt` → `decrypt` round-trip preserves input
   - Different IV generated per encryption call
   - Ciphertext includes GCM tag (length = plaintext + 16)

3. **DatabaseKeyManager**
   - First call (no stored key): generates new, encrypts, stores, returns key
   - Subsequent calls: reads stored, decrypts, returns same key
   - Key bytes match `DatabaseKeyGenerator.generate()` output format

### Integration Tests (Android Instrumented)
1. **Full flow**: `DatabaseKeyManager.getKey()` → `AutofillDatabaseHelper` → SQLCipher DB open/read/write
2. **Process death survival**: Kill app process, restart, verify DB still opens
3. **Multiple vaults**: Verify each vault file gets independent DB_KEY

## Notes
- No migration logic for existing plaintext keys
- Min SDK: API 23+ (AndroidKeyStore AES/GCM support)
- GCM tag embedded in ciphertext (last 16 bytes), not stored separately
- IV: 12 bytes (GCM recommended)
- No biometric auth requirement (background autofill must work without user interaction)