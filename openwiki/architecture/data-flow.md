---
type: architecture
title: Data Flow
description: Vault lifecycle, file storage pipeline, and autofill sync data flows
tags: [architecture, data-flow]
---
# Data Flow

> **Status**: Draft - needs full content from source evidence

## Vault Lifecycle

```mermaid
stateDiagram-v2
    [*] --> NoVault: App start
    NoVault --> Creating: User creates new vault
    NoVault --> Importing: User imports vault file
    Creating --> Unlocked: createDataFile() success
    Importing --> Unlocked: openImportedDataFile() success
    Unlocked --> Locked: lockDataFile() / auto-lock
    Unlocked --> Closing: closeDataFile()
    Locked --> Unlocking: unlockFile(PIN) / biometric
    Unlocking --> Unlocked: Success
    Unlocking --> Locked: Failed
    Closing --> NoVault: Complete
    Locked --> NoVault: closeDataFile()
```

## File Storage Pipeline

```mermaid
flowchart TD
    subgraph "Create New Vault"
        A[createDataFile(fileName, pin?)] --> B{pin provided?}
        B -->|Yes| C[createCryptoKey(pin)]
        B -->|No| D[Plaintext vault]
        C --> E[encryptData(vault, key, salt)]
        E --> F[persistVaultRecord(fileName, encrypted)]
        D --> F
        F --> G[setupVaultSession(fileName, cryptoKey?, salt?)]
        G --> H[initializeStores()]
        H --> I[exportDataFile()]
    end
    
    subgraph "Open Existing Vault"
        J[unlockFile(fileName, pin)] --> K[fileTable.getActiveFileInfo()]
        K --> L{encrypted?}
        L -->|Yes| M[decryptVaultData(fileData, pin, salt)]
        L -->|No| N[Plaintext fileData]
        M --> O[setupVaultSession(fileName, cryptoKey, salt)]
        N --> O
        O --> H
    end
    
    subgraph "Import Vault File"
        O2[openImportedDataFile(json, pin, fileName)] --> P{encrypted?}
        P -->|Yes| Q[verifyPin(data, pin)]
        P -->|No| R[parseFileData]
        Q --> S[decryptVaultData]
        S --> T[replaceDatabaseData(decrypted)]
        R --> T
        T --> U[setupVaultSession]
        U --> H
    end
```

## File Storage Pipeline Functions (fileStorage.ts)

| Phase | Function | Input | Output | Purpose |
|-------|----------|-------|--------|---------|
| 1 | `createEncryptedVault(vaultData, pin)` | vaultData, pin | {encryptedVaultData, cryptoKey, salt} | PIN → CryptoKey → encrypt vault |
| 1.5 | `decryptVaultData(encryptedData, pin, salt)` | encrypted, pin, salt | {decryptedVaultData, cryptoKey} | PIN + salt → CryptoKey → decrypt vault |
| 2 | `persistVaultRecord(fileName, vaultData)` | fileName, vaultData | void | Save to IndexedDB files table |
| 3 | `setupVaultSession({fileName, cryptoKey, salt})` | session data | void | Store in sessionStore |
| 3.5 | `initializeStores()` | - | void | Load accounts/templates from Dexie |
| 4 | ~~syncAutofillToken()~~ | - | void | **DEPRECATED** - no-op |
| 5 | `exportDataFile(data, fileName)` | data, fileName | void | Write to Documents folder |

## Vault Unlock Flow (PIN)

```mermaid
sequenceDiagram
    participant User
    participant AuthPage
    participant fileStorage
    participant sessionStore
    participant fileTable
    participant Dexie
    
    User->>AuthPage: Enter PIN
    AuthPage->>fileStorage: unlockFile(fileName, pin)
    fileStorage->>fileTable: getActiveFileInfo()
    fileTable-->>fileStorage: {encrypted, fileData, salt, activeFileName}
    alt Encrypted
        fileStorage->>fileStorage: decryptVaultData(fileData, pin, salt)
        decryptVaultData->>crypto: createCryptoKey(pin, salt)
        decryptVaultData->>crypto: decryptData(encrypted, key)
        decryptVaultData-->>fileStorage: {decryptedVaultData, cryptoKey}
        fileStorage->>sessionStore: setSession({fileName, cryptoKey, salt})
    else Plaintext
        fileStorage->>sessionStore: setSession({fileName, cryptoKey: undefined, salt: undefined})
    end
    fileStorage-->>AuthPage: decryptedVaultData
    AuthPage->>fileStorage: initializeStores()
    fileStorage->>accountStore: loadAccounts()
    fileStorage->>templateStore: loadTemplates()
    accountStore->>Dexie: accountTable.getAll(cryptoKey)
    templateStore->>Dexie: templateTable.getAll(cryptoKey)
    Dexie-->>Stores: Decrypted records
    AuthPage-->>User: Navigate to /accounts
```

## Vault Unlock Flow (Biometric)

```mermaid
sequenceDiagram
    participant User
    participant AuthPage
    participant SecureKeyPlugin
    participant BiometricAuthHelper
    participant Keystore
    participant DataStore
    participant fileStorage
    participant sessionStore
    
    User->>AuthPage: Tap biometric button
    AuthPage->>SecureKeyPlugin: unlockKeyWithBiometric(vaultId)
    SecureKeyPlugin->>BiometricAuthHelper: unlockKeyWithBiometric(vaultId)
    BiometricAuthHelper->>Keystore: getOrCreateKey(kiyo_secure_master_key)
    BiometricAuthHelper->>DataStore: Read encrypted cryptoKey
    BiometricAuthHelper->>Keystore: Cipher.init(DECRYPT) + CryptoObject
    BiometricAuthHelper->>BiometricPrompt: authenticate()
    User->>BiometricPrompt: Biometric auth
    BiometricPrompt-->>BiometricAuthHelper: Authenticated cipher
    BiometricAuthHelper->>BiometricAuthHelper: doFinal(encryptedKey)
    BiometricAuthHelper-->>SecureKeyPlugin: cryptoKeyBase64
    SecureKeyPlugin-->>AuthPage: {key: cryptoKeyBase64}
    AuthPage->>fileTable: getActiveFileInfo() → get salt
    AuthPage->>sessionStore: setCryptoKeyFromBase64(keyBase64, salt)
    AuthPage->>fileStorage: initializeStores()
    fileStorage->>Stores: loadAccounts/loadTemplates
    AuthPage-->>User: Navigate to /accounts
```

## Autofill Sync Flow

```mermaid
sequenceDiagram
    participant AccountStore
    participant sessionStore
    participant db
    participant KiyoAutofillPlugin
    participant KiyoAutofillService
    participant AutofillRepository
    
    AccountStore->>AccountStore: _persistAccounts() (after CRUD)
    AccountStore->>sessionStore: getState()
    AccountStore->>db: syncDatabaseToFile(activeFileName, cryptoKey, salt)
    db->>db: getDatabaseSnapshot(filename, cryptoKey)
    db->>db: accountTable.getAll(cryptoKey)
    db->>db: templateTable.getAll(cryptoKey)
    db-->>AccountStore: KiyoVaultData
    AccountStore->>Filesystem: writeFile(vaultData)
    AccountStore->>AccountStore: syncToAutofill()
    AccountStore->>KiyoAutofillPlugin: isAutofillEnabled()
    KiyoAutofillPlugin-->>AccountStore: {enabled, isOurService}
    alt Enabled & Our Service
        AccountStore->>AccountStore: getAutofillAccounts()
        AccountStore->>KiyoAutofillPlugin: syncAccountsFromReact(accountsJson)
        KiyoAutofillPlugin->>KiyoAutofillService: Sync accounts
        KiyoAutofillService->>AutofillRepository: Bulk upsert
        AutofillRepository-->>Service: Result
        Service-->>Plugin: SyncAccountsResult
        Plugin-->>AccountStore: Result
    end
```

## Account CRUD → Persistence Flow

```mermaid
flowchart TD
    A[User Action: Add/Edit/Delete Account] --> B[accountStore.addAccount/updateAccount/deleteAccount]
    B --> C[accountTable.create/update/delete with cryptoKey]
    C --> D[Dexie: accounts table]
    D --> E[_persistAccounts()]
    E --> F[syncDatabaseToFile]
    F --> G[getDatabaseSnapshot]
    G --> H[accountTable.getAll(cryptoKey)]
    H --> I[Filesystem.writeFile]
    E --> J[syncToAutofill]
    J --> K[KiyoAutofill.syncAccountsFromReact]
    K --> L[AutofillRepository.upsertAccount]
```

## Template CRUD → Persistence Flow

```mermaid
flowchart TD
    A[User Action: Create/Edit/Delete Template] --> B[templateStore.createTemplate/updateTemplate/deleteTemplate]
    B --> C[templateTable.create/update/delete with cryptoKey]
    C --> D[Dexie: templates table]
    D --> E[syncDatabaseToFile]
    E --> F[getDatabaseSnapshot]
    F --> G[templateTable.getAll(cryptoKey)]
    G --> H[Filesystem.writeFile]
```

## File Export/Import

### Export (User-initiated)
```mermaid
sequenceDiagram
    participant SettingsPage
    participant fileStorage
    participant db
    participant Filesystem
    
    SettingsPage->>fileStorage: exportVaultFile()
    fileStorage->>db: getDatabaseSnapshot(activeFileName, cryptoKey)
    db-->>fileStorage: KiyoVaultData
    fileStorage->>fileStorage: createEncryptedVault(vaultData, pin) OR plaintext
    fileStorage->>Filesystem: writeFile(encryptedData, fileName)
    Filesystem-->>fileStorage: OK
    fileStorage-->>SettingsPage: Success
```

### Import (User-initiated)
```mermaid
sequenceDiagram
    participant HomePage
    participant fileStorage
    participant FilePicker
    participant db
    
    HomePage->>FilePicker: pickFile()
    FilePicker-->>HomePage: File
    HomePage->>fileStorage: openImportedDataFile(file.text(), pin, fileName)
    fileStorage->>fileStorage: parseFileData(json)
    alt Encrypted
        fileStorage->>crypto: verifyPin(data, pin)
        fileStorage->>crypto: decryptVaultData(data, pin, salt)
    end
    fileStorage->>db: replaceDatabaseData(decryptedVaultData)
    db->>db: Clear tables, insert accounts/templates
    fileStorage->>fileStorage: setupVaultSession
    fileStorage->>Stores: initializeStores()
    fileStorage-->>HomePage: KiyoVaultData
    HomePage-->>User: Navigate to accounts
```

## Data Consistency Invariants

| Invariant | Enforcement |
|-----------|-------------|
| Single active vault | `files` table uses fixed ID `"active"` |
| Vault file matches IndexedDB | `syncDatabaseToFile` writes snapshot after every CRUD |
| Autofill DB matches React vault | `syncToAutofill` called after every account CRUD |
| CryptoKey never persisted | Only in memory (React) or Keystore-wrapped (Android) |
| Salt per vault file | Stored in `files` table, used for PBKDF2 recreation |
| Auto-lock clears cryptoKey | `lockDataFile()` → sessionStore.clearCryptoKey() |

## Source Anchors

- Pipeline functions: `/src/database/fileStorage.ts` lines 44-140
- Vault create/unlock: `/src/database/fileStorage.ts` lines 280-380
- File export/import: `/src/database/fileStorage.ts` lines 144-240
- Session setup: `/src/database/fileStorage.ts` lines 113-128
- Account CRUD: `/src/store/accountStore.ts` lines 35-97
- Template CRUD: `/src/store/templateStore.ts` lines 39-95
- Sync to autofill: `/src/store/accountStore.ts` lines 99-137
- Autofill sync: `/android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt` lines 130-180
- File storage tests: `/src/database/fileStorage.lifecycle.integration.test.ts`