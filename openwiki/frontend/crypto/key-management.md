---
type: overview
title: Key Management
description: CryptoKey creation, import/export, and base64 encoding for vault encryption.
tags: [crypto, key-management, pbkdf2, aes-gcm, webcrypto]
---
# Key Management

KIYO's key management system handles the creation, derivation, import, export, and encoding of cryptographic keys used for vault and record encryption. This layer abstracts the Web Crypto API and provides secure handling of key material.

## Purpose

Key management provides:
1. **Secure Key Derivation**: PBKDF2 with 100,000 iterations from user PIN
2. **Key Storage Protection**: Keys never persist in plaintext; always encrypted via Android Keystore
3. **Cross-Platform Consistency**: Uniform crypto operations across WebView and native contexts
4. **Key Lifecycle Management**: Import/export for secure key transfer between layers
5. **Encoding Utilities**: Base64/base64url for safe storage and transmission

## Key Derivation (PBKDF2)

The primary key derivation function creates AES-GCM keys from user PINs:

```typescript
export async function createCryptoKey(pin: string, salt?: Uint8Array) {
  const keySalt = salt ?? crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(keySalt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );

  return {
    key,
    salt: keySalt,
  };
}
```

### Process
1. **Input**: User PIN (string) and optional salt (for verification)
2. **Key Material**: Import PIN bytes as raw key material for PBKDF2
3. **Derivation**: PBKDF2-SHA256 with 100,000 iterations produces AES-256 key
4. **Output**: Returns `{ key: CryptoKey, salt: Uint8Array }` for storage/use

The salt is either provided (for PIN verification) or generated randomly (for new vault creation).

## Key Import/Export

For secure key transfer between React layer and Android native layer:

```typescript
// Export CryptoKey to raw bytes for Android Keystore storage
export const exportKey = async (key: CryptoKey): Promise<Uint8Array> => {
  const exported = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(exported as ArrayBuffer);
};

// Import raw bytes from Android Keystore as CryptoKey
export const importKey = async (
  keyData: Uint8Array,
  algorithm: string,
  usages: KeyUsage[]
): Promise<CryptoKey> => {
  return crypto.subtle.importKey("raw", keyData.buffer as ArrayBuffer, { name: algorithm }, true, usages);
};
```

### Usage Flow
1. **React Layer**: Derive vault key from PIN using `createCryptoKey()`
2. **Export to Android**: `exportKey()` to get raw bytes
3. **Android Storage**: Encrypt raw bytes with `kiyo_master_key` or `kiyo_secure_master_key` and store
4. **Retrieval**: Decrypt with Android Keystore, pass raw bytes to React
5. **Import in React**: `importKey()` to reconstruct CryptoKey for operations

## Base64 Encoding Utilities

For safe storage and transmission of binary data:

```typescript
export const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const fromBase64 = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};
```

### CryptoKey Encoding
```typescript
export const exportCryptoKey = async (
  cryptoKey: CryptoKey,
): Promise<string> => {
  try {
    const rawKey = await crypto.subtle.exportKey("raw", cryptoKey);
    return toBase64(new Uint8Array(rawKey));
  } catch (error) {
    console.error("CryptoKey export failed:", error);
    throw error;
  }
};
```

Used for:
- Storing encrypted vault keys in IndexedDB
- Transmitting keys between React and Android layers
- Backup/restore of encryption keys
- Debugging and logging (in development only)

## PIN Verification

The `verifyPin` function combines key derivation and decryption attempt:

```typescript
export const verifyPin = async (
  data: KiyoVaultData | EncryptedKiyoVaultData,
  pin: string,
): Promise<boolean> => {
  if (!isEncryptedKiyoVaultData(data)) {
    throw new Error("데이터가 암호화되어 있지 않습니다.");
  }

  try {
    // Create key using stored salt
    const { key } = await createCryptoKey(pin, fromBase64(data.salt));
    
    // Attempt decryption - success means correct PIN
    await decryptData(data, key);
    return true;
  } catch {
    return false; // Decryption failed = wrong PIN
  }
};
```

This avoids timing attacks by performing constant-time operations where possible and only returning boolean success/failure.

## Security Properties

- **Iteration Count**: 100,000 PBKDF2 iterations balances security and performance
- **Salt Usage**: Unique salt per vault prevents rainbow table attacks
- **Key Isolation**: Derived keys are cryptographically independent from input PIN
- **Algorithm Strength**: AES-256-GCM provides 256-bit encryption with authentication
- **Key Protection**: Keys encrypted with Android Keystore keys when at rest
- **Memory Safety**: Keys zeroed after use where possible

## Integration Points

### Vault Encryption
- **File**: `/src/crypto/encryption.ts`
- **Used by**: `/src/database/fileStorage.ts` for vault CRUD operations

### Record Encryption
- **File**: `/src/crypto/recordEncryption.ts`
- **Uses**: Same key derivation for per-account keys

### Android Integration
- **SecureKey Plugin**: `/src/plugins/kiyosecurekey.ts` and `.web.ts`
- **Key Managers**: 
  - `/openwiki/android/security/database-key-manager.md` (DB_KEY)
  - `/openwiki/android/security/secure-key-manager.md` (vault key for React)
  - `/openwiki/android/security/keystore-manager.md` (master keys)

### Stores
- **Session Store**: `/src/store/sessionStore.ts` manages cryptoKey state
- **Account Store**: `/src/store/accountStore.ts` uses keys for decryption

## Testing

- **Unit Tests**: `/src/crypto/encryption.test.ts` and `crypto.utils.test.ts`
- **Integration Tests**: `/src/database/fileStorage.encryption.integration.test.ts`
- **Property-Based Testing**: Random PINs, salts, and data validation
- **Cross-Browser**: `@peculiar/webcrypto` ensures consistent behavior

## Source

- Files: `/src/crypto/encryption.ts`, `/src/crypto/crypto.utils.ts`
- Models: `/src/models/vault.ts` (KiyoVaultData, EncryptedKiyoVaultData)
- Usage: Throughout `/src/database/` and `/src/store/` layers
- Android: Key transfer via Capacitor plugins in `/src/plugins/`