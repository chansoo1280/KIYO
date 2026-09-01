---
type: model
title: Vault Model
description: Represents the snapshot of accounts/templates/metadata that is encrypted into the file record and decrypted back into stores on unlock.
tags: [model, vault, data-structure, kiyo-vault-data]
---
# Vault Model
KiyoVaultData is the plaintext snapshot of all vault state used by getDatabaseSnapshot and write-back paths. The encrypted counterpart is EncryptedKiyoVaultData.
Source File: /src/models/vault.ts and /src/crypto/encryption.ts.
Plaintext Interface (KiyoVaultData):
export interface KiyoVaultData {
  version: 1;
  fileName: string; // e.g., "kiyo-data.json"
  updatedAt: number;
  accounts: Account[];
  templates: Template[];
  metadata: FileMetadata[];
}
Encrypted Interface (EncryptedKiyoVaultData):
export interface EncryptedKiyoVaultData {
  version: 1;
  encrypted: true;
  salt: string; // base64(16 bytes)
  iv: string;   // base64(12 bytes)
  ciphertext: string; // base64(AES-GCM ciphertext + 16-byte GCM tag)
}
Properties Explained
| Property | Type | Description |
|----------|------|-------------|
| version | 1 | Format version (literal `1`) |
| fileName | string | The vault file name |
| updatedAt | number | ms epoch of the last write |
| accounts | Account[] | Snapshot of all accounts at write time |
| templates | Template[] | Snapshot of all templates |
| metadata | FileMetadata[] | App-level metadata |
| salt | string (b64) | PBKDF2 salt (16 bytes) |
| iv | string (b64) | AES-GCM IV (12 bytes) |
| ciphertext | string (b64) | AES-GCM ciphertext |
Usage
- fileStorage.createDataFile uses KiyoVaultData as the initial plaintext (with devAccounts + BUILTIN_TEMPLATES).
- fileStorage.getDatabaseSnapshot builds a KiyoVaultData from the current accountTable + templateTable.
- fileStorage.encryptData wraps the KiyoVaultData into EncryptedKiyoVaultData (returns { salt, iv, ciphertext }) and stores it in the files table.
- fileStorage.decryptVaultData reverses the process: { encrypted } → { decryptedVaultData, cryptoKey }.
Source Anchors
models/vault.ts: /src/models/vault.ts
crypto/encryption.ts: /src/crypto/encryption.ts (EncryptedKiyoVaultData)
fileStorage.ts: /src/database/fileStorage.ts (createEncryptedVault, decryptVaultData)