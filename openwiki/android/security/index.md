# Files

- [DatabaseKeyGenerator](database-key-generator.md) - Generates the random 32-byte DB_KEY used for SQLCipher encryption.
- [DatabaseKeyManager](database-key-manager.md) - SQLCipher DB_KEY wrapper with alias-pointer mechanism, atomic rewrap, KPInvalidated/AEADBadTag reset, and 1-shot flag surface.
- [EncryptedKey](encrypted-key.md) - JSON serialization for {iv, ciphertext} blobs that wrap DB_KEY in DataStore.
- [KeystoreManager](keystore-manager.md) - alias-keyed AES-256-GCM keys in AndroidKeyStore with no caching. Supports both auth-required (autofill master) and non-auth (INDEX_KEY) generation.
- [KeystoreProvider](keystore-provider.md) - Interface abstraction over the keystore implementation for dependency injection in tests.
