# KIYO Glossary

Canonical vocabulary for KIYO. One term = one meaning. Cross-process ambiguities are called out explicitly.

---

### Account

**Definition**: A single credential record (title + fields) inside a vault. Encrypted as part of the vault blob, never stored in plain Dexie rows. Distinct from **AutofillAccount** (the same record projected to the native SQLCipher DB for AutofillService).

**Used in**:
- `src/types/account.ts` — React-side Account type (encrypted record)
- `src/store/accountStore.ts` — CRUD for accounts within an unlocked vault
- `android/.../AutofillRepository.kt` — AutofillAccount projection for native DB

**Antipattern**: "Account" used to mean the native Autofill DB row — use `AutofillAccount` there.

**Origin**: Seed glossary (2026-09-04)

---

### AutofillAccount

**Definition**: The native projection of an Account into the AutofillService SQLCipher database. Contains decrypted fields suitable for autofill matching/filling. Lives only in the native process.

**Used in**:
- `android/.../AutofillRepository.kt` — Table schema, insert/update/delete
- `android/.../KiyoAutofillService.kt` — Query during autofill request

**Antipattern**: Confusing with React-side `Account` (encrypted, inside vault blob).

**Origin**: Seed glossary (2026-09-04)

---

### AutofillService

**Definition**: Android system service running in a separate process. Has its own auth state. Does NOT share the React app's `cryptoKey`. Any "shared" data goes through the Capacitor bridge as encrypted blobs.

**Used in**:
- `android/.../KiyoAutofillService.kt` — Main service implementation
- `android/.../AutofillRepository.kt` — Data access for autofill
- `src/plugins/kiyautofill.ts` — Capacitor bridge TS wrapper

**Antipattern**: Assuming React auth state (SecuritySession) is visible to AutofillService.

**Origin**: Seed glossary (2026-09-04)

---

### cryptoKey

**Definition**: The PIN-derived AES-GCM key in the WebView process (React). Derived via PBKDF2 (100k iterations) from user PIN + vault salt. Used to encrypt/decrypt the vault blob and individual records. **Not the same** as the Keystore-wrapped DB key on the native side; never round-trip through Capacitor.

**Used in**:
- `src/crypto/encryption.ts:deriveKey` — Key derivation
- `src/crypto/recordEncryption.ts` — Record-level encrypt/decrypt
- `src/store/sessionStore.ts` — Held in SecuritySession (memory only)

**Antipattern**: Calling the native SQLCipher key "cryptoKey" — that is `dbKey`.

**Origin**: Seed glossary (2026-09-04)

---

### dbKey

**Definition**: The SQLCipher encryption key for the AutofillService database. Wrapped by `kiyo_master_key` in the Android Keystore. Lives only in native process.

**Used in**:
- `android/.../DatabaseKeyManager.kt` — wrap/unwrap DB key
- `android/.../AutofillRepository.kt` — Open SQLCipher DB with this key

**Antipattern**: Confusing with `cryptoKey` (React PIN-derived key) or `kiyo_master_key` (Keystore alias).

**Origin**: Seed glossary (2026-09-04)

---

### kiyo_master_key

**Definition**: Android Keystore alias for the autofill DB-key wrapper (`dbKey`). Requires user authentication (PIN/pattern/biometric) to unwrap. Distinct from **kiyo_secure_master_key** (biometric vault wrapper) and **kiyo_index_key** (non-auth metadata DB).

**Used in**:
- `android/.../KeystoreManager.kt` — Create/retrieve keystore entry
- `android/.../DatabaseKeyManager.kt` — Wrap/unwrap dbKey

**Antipattern**: Using this alias for the biometric vault key — that is `kiyo_secure_master_key`.

**Origin**: Seed glossary (2026-09-04)

---

### kiyo_secure_master_key

**Definition**: Android Keystore alias for the biometric vault key wrapper. Protects the key that encrypts the secure vault (biometric-unlocked vault). Distinct from `kiyo_master_key` (autofill) and `kiyo_index_key` (non-auth).

**Used in**:
- `android/.../SecureKeyManager.kt` — Create/retrieve keystore entry
- `android/.../BiometricAuthHelper.kt` — CryptoObject for biometric prompt

**Antipattern**: Using this for autofill DB — that is `kiyo_master_key`.

**Origin**: Seed glossary (2026-09-04)

---

### kiyo_index_key

**Definition**: Android Keystore alias for the non-authenticated metadata DB key wrapper. Used for vault index/metadata that doesn't require user auth. Distinct from `kiyo_master_key` and `kiyo_secure_master_key`.

**Used in**:
- `android/.../KeystoreManager.kt` — Non-auth key creation

**Antipattern**: Using for any auth-required data.

**Origin**: Seed glossary (2026-09-04)

---

### PIN

**Definition**: The user's secret string entered at vault unlock. Distinct from **password** (a field stored inside an Account) and **biometric token** (system auth, unlocks a separate secure vault).

**Used in**:
- `src/pages/Unlock.tsx` — PIN entry UI
- `src/crypto/encryption.ts:deriveKey` — PBKDF2 input
- `src/store/sessionStore.ts` — Session creation

**Antipattern**: Calling the vault encryption key "PIN" — PIN is the human input; the derived key is `cryptoKey`.

**Origin**: Seed glossary (2026-09-04)

---

### SecuritySession

**Definition**: The in-memory unlocked state: `cryptoKey` (AES derived from PIN via PBKDF2) + the active vault's decrypted contents. `fileName` and `salt` are the only persisted pieces (in Zustand + IndexedDB for session restore). Keys never persisted.

**Used in**:
- `src/store/sessionStore.ts` — Session state, actions (lock/unlock)
- `src/pages/Vault.tsx` — Consumes session for vault operations
- `src/hooks/useSecuritySession.ts` — React hook for session access

**Antipattern**: Persisting `cryptoKey` to disk/IndexedDB — only `fileName` and `salt` persist.

**Origin**: Seed glossary (2026-09-04)

---

### lockDataFile

**Definition**: Auto-lock trigger. Clears `cryptoKey` from session store (via `clearCryptoKey()`), keeping `activeFileName` and `salt` for unlock recovery. Called by `useAutoLock` when timer expires. Does NOT clear accounts/templates/metadata — those stay in memory until explicit `closeDataFile`.

**Used in**:
- `src/database/fileStorage.ts:168` — Implementation
- `src/hooks/useAutoLock.ts:38` — Timer expiry callback

**Antipattern**: Calling this expecting full vault close — it only locks (clears key). Use `closeDataFile` for full close.

**Origin**: Added 2026-09-04 (audit)

---

### unlockFile

**Definition**: Unlocks an encrypted vault file with PIN. Derives `cryptoKey` via PBKDF2, decrypts vault blob, populates stores (`accountStore`, `templateStore`, `metadataStore`), and sets up session via `setupVaultSession`. Returns decrypted `KiyoVaultData` or `null` on wrong PIN.

**Used in**:
- `src/database/fileStorage.ts:172` — Implementation
- `src/pages/Auth.tsx:82` — PIN verification flow

**Antipattern**: Calling without `fileName` + valid `salt` from fileTable.

**Origin**: Added 2026-09-04 (audit)

---

### clearCryptoKey

**Definition**: Clears only the `cryptoKey` from session store (sets to `null`). Keeps `activeFileName` and `salt` for potential unlock without re-entering file selection. Used by `lockDataFile` (auto-lock).

**Used in**:
- `src/store/sessionStore.ts:80` — Implementation
- `src/database/fileStorage.ts:169` — Called by `lockDataFile`

**Antipattern**: Expecting this to clear accounts/data — it only clears the key.

**Origin**: Added 2026-09-04 (audit)

---

### clearSession

**Definition**: Clears entire session state: `activeFileName`, `cryptoKey`, `salt`, `initialized = false`. Used by `closeDataFile` (user-initiated vault close) and `activatePlaintextVault` (plaintext vault setup). Does NOT clear stores — caller must clear accounts/templates/metadata separately.

**Used in**:
- `src/store/sessionStore.ts:84` — Implementation
- `src/database/fileStorage.ts:158` — Called by `closeDataFile`
- `src/database/fileStorage.ts:124` — Called by `activatePlaintextVault` (error path)

**Antipattern**: Expecting this to clear stores or autofill data — it only clears session.

**Origin**: Added 2026-09-04 (audit)

---

### lockedRef (useAutoLock internal)

**Definition**: Internal `useRef` flag in `useAutoLock` that prevents timer restart after auto-lock has fired. Set to `true` when timer expires and `lockDataFile()` is called. Reset to `false` only by `closeDataFile` (via session clear) or explicit unlock flow.

**Used in**:
- `src/hooks/useAutoLock.ts:23, 36, 47, 75` — Guard checks

**Antipattern**: Treating as persistent lock state — it's an in-memory ref only.

**Origin**: Added 2026-09-04 (audit)

---

### Vault

**Definition**: A single encrypted JSON file in the Files table (Dexie + native). One PIN unlocks one vault. Distinct from **Account** (a record inside a vault) and **SecuritySession** (the in-memory unlocked state of one vault).

**Used in**:
- `src/database/fileStorage.ts` — Encrypted vault I/O (createEncryptedVault, persistVaultRecord, exportVaultFile)
- `src/types/vault.ts` — VaultFile type (encrypted blob + metadata)
- `src/store/accountStore.ts` — Accounts live inside a vault

**Antipattern**: "Vault" used to mean the unlocked in-memory state — that is `SecuritySession`.

**Origin**: Seed glossary (2026-09-04)

---

### AutofillRepository

**Definition**: Native Kotlin repository managing the AutofillService SQLCipher database. Handles AutofillAccount CRUD, DB key lifecycle (via DatabaseKeyManager), and query/match logic for autofill requests.

**Used in**:
- `android/.../AutofillRepository.kt` — Implementation
- `android/.../KiyoAutofillService.kt` — Injected dependency

**Antipattern**: Confusing with React-side accountStore — different process, different data model, different encryption.

**Origin**: Seed glossary (2026-09-04)

---

### DatabaseKeyManager

**Definition**: Native Kotlin manager for the Autofill DB key (`dbKey`). Wraps/unwraps `dbKey` using `kiyo_master_key` from Keystore. Persists wrapped key to DataStore.

**Used in**:
- `android/.../DatabaseKeyManager.kt` — wrapKey, unwrapKey, getKey
- `android/.../AutofillRepository.kt` — Called on DB open

**Antipattern**: Performing auth-dependent init in AutofillService.onCreate() — use lazy init.

**Origin**: Seed glossary (2026-09-04)

---

### KeystoreManager

**Definition**: Native Kotlin manager for Android Keystore entries: `kiyo_master_key`, `kiyo_secure_master_key`, `kiyo_index_key`. Handles creation, retrieval, and deletion of keystore aliases.

**Used in**:
- `android/.../KeystoreManager.kt` — createKey, getKey, deleteKey
- `android/.../DatabaseKeyManager.kt` — Uses KeystoreManager for kiyo_master_key
- `android/.../SecureKeyManager.kt` — Uses KeystoreManager for kiyo_secure_master_key

**Antipattern**: Direct Keystore API calls scattered — centralise here.

**Origin**: Seed glossary (2026-09-04)

---

### SecureKeyManager

**Definition**: Native Kotlin manager for the biometric vault key lifecycle. Wraps/unwraps the secure vault key using `kiyo_secure_master_key` from Keystore. Works with BiometricAuthHelper for CryptoObject-based auth. Manages a **single global** biometric-protected key (not per-vault).

**Used in**:
- `android/.../SecureKeyManager.kt` — wrap/unwrap secure vault key
- `android/.../BiometricAuthHelper.kt` — BiometricPrompt with CryptoObject

**Antipattern**: Confusing with DatabaseKeyManager — different key, different Keystore alias, different auth flow. Assuming per-vault keys — there is only one global biometric key.

**Origin**: Seed glossary (2026-09-04), updated 2026-09-04 (global key)

---

### BiometricAuthHelper

**Definition**: Native Kotlin helper for biometric authentication using CryptoObject. Handles BiometricPrompt, CryptoObject creation, and auth result callbacks for the secure vault unlock flow. Manages a **single global** biometric-protected key (not per-vault).

**Used in**:
- `android/.../BiometricAuthHelper.kt` — authenticate(), storeKey, unlockKeyWithBiometric, deleteKey, hasKey
- `android/.../SecureKeyPlugin.kt` — Capacitor bridge for biometric unlock

**Antipattern**: Using for autofill auth — autofill uses `kiyo_master_key` with standard Keystore auth, not CryptoObject. Assuming per-vault keys — there is only one global biometric key.

**Origin**: Seed glossary (2026-09-04), updated 2026-09-04 (global key)

---

### Capacitor Bridge

**Definition**: The communication layer between React (WebView) and Android Native. KIYO uses `KiyoAutofillPlugin` (TS) ↔ `KiyoAutofillPlugin` (Kotlin) for autofill sync, and `SecureKeyPlugin` for biometric vault unlock. Data crossing the bridge is always encrypted blobs — never raw keys.

**Used in**:
- `src/plugins/kiyautofill.ts` — TS plugin definition
- `android/.../KiyoAutofillPlugin.kt` — Native plugin implementation
- `src/plugins/secureKey.ts` / `android/.../SecureKeyPlugin.kt` — Biometric bridge

**Antipattern**: Passing `cryptoKey` or `dbKey` across the bridge — keys never leave their process.

**Origin**: Seed glossary (2026-09-04)

---

### syncAutofillToken (deprecated)

**Definition**: Former bridge call to sync React auth state to AutofillService. **Deprecated/no-op** — Autofill now uses pure Keystore-based auth only. Kept in glossary as a historical marker.

**Used in**:
- `src/plugins/kiyautofill.ts` — Marked deprecated
- `android/.../KiyoAutofillPlugin.kt` — No-op implementation

**Antipattern**: Reviving this call — AutofillService must not depend on React process auth state.

**Origin**: Seed glossary (2026-09-04)

---

### AutofillTestLogin (dev page)

**Definition**: Development/test page at `/autofill-test` route. Provides a login form with proper `autoComplete` attributes (`username`/`current-password`) to test Android AutofillService integration. Not a production feature.

**Used in**:
- `src/pages/AutofillTestLogin.tsx` — Page component
- `src/App.tsx:8,39` — Route registration

**Antipattern**: Including in production build — should be gated by `import.meta.env.DEV` or removed from release.

**Origin**: Added 2026-09-04 (audit)

---

### buildSnapshotFromStores

**Definition**: Read-only helper that composes a `KiyoVaultData` JSON from current in-memory stores (`accountStore`, `templateStore`, `metadataStore`) plus `fileName` + timestamp. Does NOT persist — caller decides where to write (fileTable, backup export, etc.). Used by `saveStoresToFile`, `exportVaultFile`, `backupDataFile`.

**Used in**:
- `src/database/fileStorage.ts:132` — Implementation
- `src/database/fileStorage.ts:148, 261` — Called by `saveStoresToFile`, `exportVaultFile`

**Antipattern**: Expecting this to save to disk — it only builds the JSON object.

**Origin**: Added 2026-09-04 (audit)

---

### loadVaultToStores

**Definition**: Distributes a decrypted `KiyoVaultData` into the three stores (`accountStore.init`, `templateStore.init`, `metadataStore.init`) and sets `sessionStore.initialized = true`. Called after unlock/import/plaintext activation. Does NOT touch session cryptoKey/salt — caller must set up session first via `setupVaultSession`.

**Used in**:
- `src/database/fileStorage.ts:112` — Implementation
- `src/database/fileStorage.ts:126, 193, 198, 313` — Called by `activatePlaintextVault`, `unlockFile`, `openImportedDataFile`

**Antipattern**: Calling without session already set up — stores will have data but session won't have cryptoKey for encryption.

**Origin**: Added 2026-09-04 (audit)

---

### saveStoresToFile

**Definition**: Orchestration function: builds snapshot via `buildSnapshotFromStores`, encrypts if session has `cryptoKey`+`salt`, writes to `fileTable.upsertFileRecord`. Called automatically after account/template/metadata mutations. No-op if no active file.

**Used in**:
- `src/database/fileStorage.ts:145` — Implementation
- `src/store/accountStore.ts:46, 57, 64, 71` — After add/update/delete/clear accounts

**Antipattern**: Calling manually when stores haven't changed — creates unnecessary write.

**Origin**: Added 2026-09-04 (audit)

---

### exportVaultFile

**Definition**: Exports current vault as backup file (encrypted if PIN provided, plaintext if not). Uses `buildSnapshotFromStores` + `createEncryptedVault`/`exportBackupFile`. Returns the `KiyoVaultData` for confirmation.

**Used in**:
- `src/database/fileStorage.ts:258` — Implementation (exported as `exportVaultFile`)
- `src/pages/Settings/components/DataSection.tsx` — Backup UI

**Antipattern**: Confusing with `saveStoresToFile` — this is for user-initiated backup export, not auto-save.

**Origin**: Added 2026-09-04 (audit)

---

### Files Table (Dexie)

**Definition**: The Dexie/IndexedDB table storing encrypted vault files. Each row = one vault file (encrypted blob + metadata: fileName, salt, version, createdAt). PK = fileName (string).

**Used in**:
- `src/database/db.ts` — Dexie schema definition
- `src/database/fileStorage.ts` — Pipeline functions (createEncryptedVault, exportVaultFile, etc.)

**Antipattern**: Storing decrypted accounts as separate rows — accounts are encrypted inside the vault blob.

**Origin**: Seed glossary (2026-09-04)

---

### KiyoVaultData

**Definition**: The decrypted vault JSON structure (version 1): `{ fileName, updatedAt, accounts: Account[], templates: Template[], metadata: FileMetadata[] }`. This is the in-memory representation after decryption. Never stored to disk in plaintext.

**Used in**:
- `src/models/vault.ts:10` — Type definition
- `src/database/fileStorage.ts` — `decryptVaultData`, `loadVaultToStores`, `buildSnapshotFromStores`
- `src/crypto/encryption.ts` — `encryptData`/`decryptData` input/output

**Antipattern**: Persisting this to disk — must be encrypted as `EncryptedKiyoVaultData` first.

**Origin**: Added 2026-09-04 (audit)

---

### EncryptedKiyoVaultData

**Definition**: The on-disk wire format for an encrypted vault: `{ version: 1, encrypted: true, salt: string (base64), iv: string (base64), ciphertext: string (base64) }`. This is what gets stored in the Files table and exported/imported as backup files.

**Used in**:
- `src/crypto/encryption.ts:11` — Type definition, `isEncryptedKiyoVaultData` guard
- `src/database/fileTable.ts` — `upsertFileRecord`, `getFileInfo` return type
- `src/database/fileStorage.ts` — `createEncryptedVault` output, `exportVaultFile`/`importVaultFile`
- `src/pages/Auth.tsx` — Biometric unlock flow

**Antipattern**: Treating as decrypted data — always decrypt via `decryptVaultData` before accessing accounts/templates.

**Origin**: Added 2026-09-04 (audit)

---

### FileMetadata

**Definition**: Per-file metadata stored inside the vault blob: `{ id: number, version: string, createdAt: number }`. Part of `KiyoVaultData.metadata` array. Used for vault version tracking and migration history.

**Used in**:
- `src/models/vault.ts:4` — Type definition
- `src/database/fileStorage.ts` — Included in vault snapshot

**Antipattern**: Confusing with `FileRecord` (the Dexie row metadata) — `FileMetadata` lives inside the encrypted blob; `FileRecord` is the Dexie table row.

**Origin**: Added 2026-09-04 (audit)

---

### FileRecord

**Definition**: The Dexie table row for the `files` table (v15+). PK = `id` (which equals `fileName`). Fields: `{ id, fileName, fileData (JSON string), encrypted, salt?, createdAt, updatedAt }`. This is the on-disk IndexedDB row — distinct from `FileMetadata` (inside encrypted blob) and `ActiveFileInfo` (parsed runtime type).

**Used in**:
- `src/database/db.ts:3` — Dexie schema definition (duplicated in fileTable.ts:7)
- `src/database/fileTable.ts:7, 50, 99, 122` — CRUD methods, getFileRecord, getAllFiles
- `src/database/fileStorage.ts` — upsertFileRecord calls
- `src/pages/RootRedirect.test.tsx` — Test mocks

**Antipattern**: Confusing with `FileMetadata` (inside vault blob) or `ActiveFileInfo` (parsed runtime type with Uint8Array salt). The `salt` field here is base64 string, not Uint8Array.

**Origin**: Added 2026-09-04 (audit)

---

### ActiveFileInfo

**Definition**: The parsed runtime type returned by `fileTable.getFileInfo()`. Discriminated union: encrypted (`{ encrypted: true, fileData: EncryptedKiyoVaultData, salt: Uint8Array, activeFileName: string }`), plaintext (`{ encrypted: false, fileData: KiyoVaultData, salt: null, activeFileName: string }`), or missing/stale (`{ encrypted: false, fileData: null, salt: null, activeFileName: null }`). Salt is Uint8Array (not base64).

**Used in**:
- `src/database/fileTable.ts:19` — Type definition
- `src/hooks/useFileAuthGuard.ts` — Guard logic
- `src/pages/RootRedirect.tsx` — Routing decisions
- `src/hooks/useFileAuthGuard.test.tsx`, `src/pages/RootRedirect.test.tsx`, `src/pages/Home.test.tsx` — Test mocks

**Antipattern**: Confusing with `FileRecord` (raw DB row, salt is base64 string) or treating `activeFileName: null` as a valid file — it means stale/missing.

**Origin**: Added 2026-09-04 (audit)

---

### lastSyncedAutofillCount (née lastAutofillAccountCount)

**Definition**: The count of accounts in the native AutofillService SQLCipher DB, cached in React session store after a successful sync. Represents **native-side state** (AutofillRepository row count), not React account count. Persisted to localStorage via session store `partialize`.

**Used in**:
- `src/store/sessionStore.ts:18, 49, 93, 103` — State field, persisted
- `src/pages/Settings/components/AutofillSection.tsx:28, 35, 93, 118, 146` — Displayed as "자동완성 DB: N개", updated on sync/clear

**Antipattern**: Treating as React account count — React accounts = `useAccountStore().accounts.length`. Autofill DB may have different count due to sync errors, filtering, or native-only entries.

**Origin**: Added 2026-09-04 (audit — drift detected)

---

### vaultId (bridge) — DEPRECATED

**Definition**: Former identifier used in Capacitor bridge calls (`SecureKey` plugin) to reference a vault file. **Removed** — biometric key is now global (single key for all vaults). The native `BiometricAuthHelper` uses a single `ENCRYPTED_KEY_KEY` in SharedPreferences regardless of vault.

**Used in**:
- *Removed from:* `src/plugins/kiyosecurekey.ts`, `src/pages/Auth.tsx`, `src/pages/Settings/components/SecuritySection.tsx`
- *Removed from native:* `SecureKeyPlugin.kt`, `BiometricAuthHelper.kt`

**Antipattern**: Assuming per-vault biometric keys — there is only one global biometric-protected key.

**Origin**: Deprecated 2026-09-04 (global key design)