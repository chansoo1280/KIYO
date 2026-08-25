---
type: overview
title: File Storage
description: Vault file CRUD operations, encryption pipeline, and import/export functionality.
tags: [database, file-storage, encryption, crud, import-export]
---
# File Storage

KIYO's file storage system handles the complete lifecycle of encrypted vault files including creation, reading, updating, deletion, import, and export. This layer integrates with Dexie for persistence and applies end-to-end encryption for data at rest.

## Purpose

File storage provides:
1. **Secure Persistence**: Encrypted vault storage using AES-GCM
2. **Complete CRUD**: Create, read, update, delete operations for vault files
3. **Import/Export**: Backup and restore functionality with encryption
4. **Atomic Operations**: Transactions ensuring data consistency
5. **Metadata Tracking**: Timestamps, versioning, and file integrity
6. **Offline Support**: Full functionality without network connectivity

## Encryption Pipeline

All vault files are encrypted end-to-end using the same crypto primitives as record encryption:

### Encryption Flow
1. **Key Derivation**: PBKDF2 from user PIN with random salt (100,000 iterations)
2. **Key Generation**: AES-256-GCM key from derived key material
3. **Data Encryption**: 
   - Serialize vault data to JSON
   - Generate random IV (12 bytes for GCM)
   - Encrypt JSON with AES-GCM
   - Produce ciphertext + authentication tag
4. **Storage Format**: 
   ```json
   {
     "version": 1,
     "encrypted": true,
     "salt": "<base64 salt>",
     "iv": "<base64 iv>",
     "ciphertext": "<base64 ciphertext>"
   }
   ```

### Decryption Flow
1. **Key Recreation**: PBKDF2 from PIN using stored salt
2. **AES-GCM Decryption**: Using derived key and stored IV
3. **Authentication**: GCM tag verifies data integrity
4. **Deserialization**: Parse decrypted JSON to vault object

## Core Operations

### Create Vault
```typescript
// In fileStorage.ts
export const createVault = async (
  name: string,
  pin: string
): Promise<KiyoVaultData> => {
  // 1. Generate encryption key from PIN
  const { key, salt } = await createCryptoKey(pin);
  
  // 2. Create empty vault structure
  const vault: KiyoVaultData = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    accounts: [],
    templates: [],
    files: [],
    settings: getDefaultSettings()
  };
  
  // 3. Encrypt vault data
  const encryptedVault = await encryptData(vault, key, salt);
  
  // 4. Persist to Dexie
  await db.vaultTable.add({
    id: vault.id,
    ...encryptedVault
  });
  
  return vault;
};
```

### Read Vault
```typescript
export const openVault = async (
  vaultId: string,
  pin: string
): Promise<KiyoVaultData> => {
  // 1. Retrieve encrypted vault from DB
  const encrypted = await db.vaultTable.get(vaultId);
  if (!encrypted) throw new Error("Vault not found");
  
  // 2. Verify it's encrypted format
  if (!isEncryptedKiyoVaultData(encrypted)) {
    throw new Error("Invalid vault format");
  }
  
  // 3. Derive key from PIN using stored salt
  const { key } = await createCryptoKey(pin, fromBase64(encrypted.salt));
  
  // 4. Decrypt and return
  return await decryptData(encrypted, key);
};
```

### Update Vault
```typescript
export const updateVault = async (
  vault: KiyoVaultData,
  pin: string
): Promise<void> => {
  // 1. Get current encrypted version for salt
  const current = await db.vaultTable.get(vault.id);
  if (!current) throw new Error("Vault not found");
  
  // 2. Derive key using existing salt (maintains key continuity)
  const { key } = await createCryptoKey(pin, fromBase64(current.salt));
  
  // 3. Update timestamp and encrypt
  vault.updatedAt = Date.now();
  const encrypted = await encryptData(vault, key, fromBase64(current.salt));
  
  // 4. Save updated encrypted version
  await db.vaultTable.put({
    id: vault.id,
    ...encrypted
  });
};
```

### Delete Vault
```typescript
export const deleteVault = async (vaultId: string): Promise<void> => {
  // Dexie cascade deletes handled via foreign key constraints in table modules
  await db.vaultTable.delete(vaultId);
  // Related accounts/templates/files deleted automatically
};
```

## Import/Export Functionality

### Export Vault
```typescript
export const exportVault = async (
  vaultId: string,
  pin: string
): Promise<string> => {
  // 1. Decrypt vault
  const vault = await openVault(vaultId, pin);
  
  // 2. Create export package (includes metadata)
  const exportData = {
    format: "kiyo-vault",
    version: 1,
    exportedAt: Date.now(),
    vault: vault  // Already decrypted
  };
  
  // 3. Encrypt export package with same PIN
  const { key, salt } = await createCryptoKey(pin);
  const encryptedExport = await encryptData(
    exportData as unknown as KiyoVaultData,
    key,
    salt
  );
  
  // 4. Return as base64 for file storage
  return JSON.stringify(encryptedExport);
};
```

### Import Vault
```typescript
export const importVault = async (
  encryptedExport: string,
  pin: string
): Promise<string> => {
  // 1. Parse export package
  const parsed = JSON.parse(encryptedExport);
  
  // 2. Verify format
  if (!isEncryptedKiyoVaultData(parsed)) {
    throw new Error("Invalid export format");
  }
  
  // 3. Decrypt with provided PIN
  const { key } = await createCryptoKey(pin, fromBase64(parsed.salt));
  const vault = await decryptData(parsed, key);
  
  // 4. Verify import data integrity
  if (vault.format !== "kiyo-vault" || vault.version !== 1) {
    throw new Error("Unsupported vault format");
  }
  
  // 5. Save as new vault (preserve original ID or generate new)
  const newId = crypto.randomUUID();
  await db.vaultTable.add({
    id: newId,
    ...parsed  // Re-encrypt with same salt (preserves key)
  });
  
  return newId;
};
```

## Integration Points

### Database Layer
- **Primary Interface**: `/src/database/fileStorage.ts`
- **Dexie Instance**: `/src/database/db.ts`
- **Table Modules**: `/src/database/table-modules/` (individual table operations)

### Crypto Layer
- **Key Derivation**: `/src/crypto/encryption.ts#createCryptoKey`
- **Encryption/Decryption**: `/src/crypto/encryption.ts#encryptData`/`#decryptData`
- **Utilities**: `/src/crypto/crypto.utils.ts` (base64 encoding)

### Store Layer
- **Session Store**: `/src/store/sessionStore.ts` (manages active vault)
- **Account Store**: `/src/store/accountStore.ts` (uses decrypted vault data)
- **Persistence Middleware**: Automatic sync between stores and DB

### UI Layer
- **Auth Page**: `/src/pages/Auth.tsx` (PIN entry for vault open/create)
- **Home Page**: `/src/pages/Home.tsx` (vault list and operations)
- **File Operations**: Import/export dialogs in settings

## Security Properties

### Encryption Strength
- **Algorithm**: AES-256-GCM (256-bit key, GCM mode)
- **Key Derivation**: PBKDF2-SHA256 with 100,000 iterations
- **Salt**: Unique 16-byte salt per vault (stored with ciphertext)
- **IV**: Unique 12-byte IV per encryption (stored with ciphertext)
- **Authentication**: GCM tag provides integrity and authenticity

### Key Management
- **Key Volatility**: CryptoKeys exist only in memory during operations
- **Salt Persistence**: Salt stored with encrypted data (necessary for verification)
- **No Key Escrow**: Keys never transmitted or stored in plaintext
- **PIN Binding**: Data cryptographically bound to user PIN

### Attack Resistance
- **Brute Force**: 100,000 iteration PBKDF2 increases cost
- **Known Plaintext**: GCM mode resists known-plaintext attacks
- **Tamper Detection**: Authentication tag detects ciphertext modification
- **Side-Constant**: Constant-time operations where feasible
- **Memory Safety**: Keys zeroed after use (where JS allows)

### Data Integrity
- **Authentication**: GCM tag validates both encryption and integrity
- **Versioning**: Format version enables future migrations
- **Validation**: `isEncryptedKiyoVaultData` guards against format errors
- **Atomic Writes**: Dexie transactions prevent partial updates

## Performance Characteristics

### Read Operations
- **Vault Open**: Single DB get + decryption (O(1) + crypto)
- **Typical Latency**: 50-200ms depending on device performance
- **Scaling**: Independent of vault size (decrypts entire vault)

### Write Operations
- **Vault Save**: Single DB put + encryption (O(1) + crypto)
- **Batch Operations**: Multiple updates in single transaction
- **Lazy Encryption**: Only encrypt when data actually changes

### Memory Usage
- **Peak Memory**: ~2x vault size during encrypt/decrypt
- **Working Set**: Only active vault kept in memory
- **Large Vaults**: Consider streaming for massive vaults (>10MB)

## Error Handling

### Specific Errors
- **VaultNotFound**: When requested vault ID doesn't exist
- **InvalidPin**: When PIN verification fails (via verifyPin)
- **CorruptedData**: When decryption or authentication fails
- **UnsupportedFormat**: When vault version doesn't match expectations
- **StorageFailure**: When IndexedDB operations fail (quota, etc.)

### Recovery Strategies
- **Import Fallback**: Try import with/without trimming whitespace
- **Backup Prompt**: Suggest backup after failed operations
- **Rollback**: Transactions automatically roll back on error
- **User Guidance**: Clear error messages with recovery steps

## Testing

### Unit Tests
- **File**: `/src/database/fileStorage.integration.test.ts`
- **Scenarios**: 
  - Create/open/update/delete cycle
  - Wrong PIN rejection
  - Empty vault handling
  - Large account/template sets
  - Import/export roundtrip
  - Concurrent operations

### Integration Tests
- **Encryption Tests**: `/src/database/fileStorage.encryption.integration.test.ts`
- **Property Tests**: Random data, pins, salts
- **Cross-Browser**: Chrome, Firefox, WebView consistency
- **Stress Testing**: 1000+ accounts, measurement of perf

### Test Utilities
- **Test Vault Factory**: Deterministic test data generation
- **Mock Crypto**: SubtleCrypto mocks for isolated testing
- **Async Helpers**: Wait for Dexie transactions to complete

## Source

### Primary Files
- `/src/database/fileStorage.ts` - Core CRUD operations
- `/src/database/db.ts` - Dexie instance and schema
- `/src/crypto/encryption.ts` - Encryption primitives
- `/src/crypto/crypto.utils.ts` - Base64 utilities

### Supporting Files
- `/src/database/table-modules/vaultTable.ts` - Vault-specific queries
- `/src/database/table-modules/accountTable.ts` - Account operations
- `/src/database/table-modules/templateTable.ts` - Template operations
- `/src/database/table-modules/fileTable.ts` - File attachment operations
- `/src/models/vault.ts` - KiyoVaultData and EncryptedKiyoVaultData interfaces
- `/src/store/sessionStore.ts` - Active vault state management

### Android Integration
- **Key Transfer**: `/src/plugins/kiyosecurekey.ts` (secure key storage)
- **Native Crypto**: Android Keystore for master key protection
- **Biometric Unlock**: `/openwiki/android/security/biometric-auth.md`

## Relationships

### Dependencies
- **Crypto Layer**: Provides encryption/decryption primitives
- **Database Layer**: Dexie provides persistence and querying
- **Model Layer**: TypeScript interfaces define data shapes
- **Store Layer**: Zustand manages application state

### Dependents
- **Auth Page**: Uses openVault/createVault for login
- **Home Page**: Lists vaults and triggers operations
- **Settings Page**: Import/export backup functionality
- **Account Operations**: Read/write account data via vault
- **Template Operations**: Read/write template data via vault
- **File Operations**: Attach/open files via vault fileTable

### Data Flow
```
UI Action → Store Update → fileStorage Function → 
  Dexie Transaction ←→ IndexedDB ←
  ↑                     ↓
Crypto Layer (encrypt/decrypt) ← Key Material
```