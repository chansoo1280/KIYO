---
type: skeleton
title: Wiki Skeleton
description: Planned documentation structure for KIYO Password Manager repository
tags: [meta, planning]
---
# KIYO Password Manager - Wiki Skeleton

## Repository Overview
KIYO is an offline-first, privacy-focused Android password manager with system-level autofill integration. It uses a React/TypeScript frontend running in a Capacitor WebView, with Kotlin native code for Android AutofillService and security (Keystore, SQLCipher).

## Wiki Structure

### 1. quickstart.md
- High-level architecture map
- Key concepts and terminology
- Task-routing table (intent → page + source entrypoints + tests + validation)

### 2. architecture/
- **overview.md** - System architecture diagram, data flows, component boundaries
- **security-model.md** - Encryption layers, key hierarchy, Keystore usage, session management
- **data-flow.md** - Vault lifecycle, file storage pipeline, sync to autofill

### 3. frontend/ (React/TypeScript/Capacitor)
- **app-structure.md** - Entry points, routing, providers, global state
- **state-management.md** - Zustand stores (session, account, template, settings), persistence
- **crypto/** 
  - **vault-encryption.md** - PBKDF2 + AES-GCM vault encryption/decryption
  - **record-encryption.md** - Per-record encryption for IndexedDB
  - **key-management.md** - CryptoKey creation, import/export, base64 encoding
- **database/**
  - **dexie-schema.md** - Tables, indexes, version migrations
  - **file-storage.md** - Vault file CRUD, encryption pipeline, import/export
  - **table-modules.md** - accountTable, templateTable, fileTable operations
- **hooks/**
  - **useAutoLock.md** - Auto-lock timer, activity detection, session locking
  - **useFileAuthGuard.md** - Route protection for file/session state
  - **useClipboard.md** - Secure clipboard operations
- **pages/**
  - **auth.md** - PIN/biometric unlock, file selection
  - **home.md** - File create/open/import dashboard
  - **accounts.md** - List, search, filter, tag management
  - **account-detail.md** - View, copy, edit, delete account
  - **account-edit.md** - Create/edit with template picker
  - **settings.md** - Security, UI, Data, Autofill sections
  - **templates.md** - Template CRUD, builtin templates
- **capacitor-plugins/**
  - **kiyautofill.md** - Autofill status, enable request, account sync
  - **kiyosecurekey.md** - Biometric key storage for React vault unlock

### 4. android/ (Kotlin Native)
- **autofill-service/**
  - **service-overview.md** - KiyoAutofillService lifecycle, onFillRequest, onSaveRequest
  - **field-detection.md** - ViewNode traversal, scoring, username/password field detection
  - **credential-extraction.md** - Extracting values from detected fields
  - **fill-response.md** - Dataset creation, SaveInfo, auth response
  - **auth-handler.md** - DatabaseKeyManager integration, UserNotAuthenticatedException flow
- **repository/**
  - **autofill-repository.md** - SQLCipher DB operations, DomainMatcher, AccountMapper
  - **database-helper.md** - SQLCipherOpenHelper, schema, migrations
  - **domain-matching.md** - Exact + subdomain matching logic
- **security/**
  - **keystore-manager.md** - kiyo_master_key (autofill DB), kiyo_secure_master_key (biometric unlock)
  - **database-key-manager.md** - DB_KEY generation, encryption, DataStore persistence
  - **secure-key-manager.md** - Biometric-bound cryptoKey storage for React vault
  - **biometric-auth.md** - CryptoObject pattern, BiometricPrompt integration
  - **encrypted-key.md** - IV + ciphertext + GCM tag serialization
- **capacitor-plugins/**
  - **kiyautofill-plugin.md** - Bridge to React, service status, account sync
  - **securekey-plugin.md** - Bridge to React, biometric key store/unlock/delete

### 5. data-models/
- **vault.md** - KiyoVaultData, EncryptedKiyoVaultData
- **account.md** - Account, AccountField, FieldType, AppSettings
- **template.md** - Template, TemplateField, DEFAULT_TEMPLATE_FIELDS
- **file-metadata.md** - FileRecord, FileMetadata

### 6. testing/
- **unit-tests.md** - Vitest setup, crypto tests, database integration tests
- **e2e-tests.md** - Playwright configuration, test scenarios
- **android-tests.md** - JUnit tests for DomainMatcher, FieldScoringRules, AuthRequestHandler

### 7. operations/
- **build.md** - Vite, TypeScript, Capacitor sync, Gradle
- **debugging.md** - Logcat tags, WebView debugging, test commands
- **release.md** - Versioning, signing, Play Store requirements

## Coverage Checklist

### Frontend (React/TypeScript)
- [x] App entry & routing (App.tsx, main.tsx)
- [x] Global state (4 Zustand stores)
- [x] Crypto: vault encryption, record encryption, key utils
- [x] Database: Dexie schema, file storage pipeline, table modules
- [x] Hooks: auto-lock, file auth guard, clipboard
- [x] Pages: Auth, Home, Accounts (list/detail/edit), Settings, Templates
- [x] Capacitor plugins: KiyoAutofill, SecureKey

### Android Native (Kotlin)
- [x] AutofillService (onFillRequest, onSaveRequest)
- [x] Field detection & scoring (ViewNode, FieldScorer)
- [x] Credential extraction
- [x] Fill response building (Dataset, SaveInfo, Auth)
- [x] Auth request handler (Keystore auth flow)
- [x] AutofillRepository (SQLCipher, DomainMatcher, AccountMapper)
- [x] Database helper (schema, migrations)
- [x] KeystoreManager (kiyo_master_key)
- [x] SecureKeyManager (kiyo_secure_master_key)
- [x] DatabaseKeyManager (DB_KEY lifecycle)
- [x] BiometricAuthHelper (CryptoObject pattern)
- [x] Capacitor plugins (KiyoAutofillPlugin, SecureKeyPlugin)

### Data Models
- [x] Vault (plain + encrypted)
- [x] Account + fields + settings
- [x] Template + fields
- [x] File metadata

### Testing
- [x] Vitest unit/integration (crypto, database, hooks)
- [x] Playwright e2e
- [x] Android JUnit (DomainMatcher, FieldScoringRules, AuthRequestHandler)

## Deferral Notes
- No backend/API - fully offline/local
- No cloud sync - explicitly out of scope
- Web platform support is partial (Capacitor web fallbacks only)
- iOS not supported - Android-only