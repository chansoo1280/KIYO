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
- **utils.md** - URL parsing and normalization functions used across the codebase
- **errors.md** - Error handling, including FileStorageError
- **crypto/** 
  - **vault-encryption.md** - PBKDF2 + AES-GCM vault encryption/decryption
  - **record-encryption.md** - Per-record encryption for IndexedDB
  - **key-management.md** - CryptoKey creation, import/export, base64 encoding
  - **crypto-utils.md** - Cryptographic utility functions
- **database/**
  - **dexie-schema.md** - Tables, indexes, version migrations
  - **file-storage.md** - Vault file CRUD, encryption pipeline, import/export, development data initialization
  - **table-modules.md** - accountTable, templateTable, fileTable operations
- **hooks/**
  - **useAutoLock.md** - Auto-lock timer, activity detection, session locking
  - **useFileAuthGuard.md** - Route protection for file/session state
  - **useClipboard.md** - Secure clipboard operations
  - **useAndroidBackButton.md** - Android back button behavior handling
- **components/**
  - **button.md** - Shared Button component
  - **auto-lock-indicator.md** - AutoLockIndicator component
  - **bottom-tabs.md** - BottomTabs component
  - **icons.md** - Icon usage and components
  - **dialogs.md** - Shared dialog components
- **pages/**
  - **auth.md** - PIN/biometric unlock, file selection
  - **home.md** - File create/open/import dashboard
  - **accounts.md** - List, search, filter, tag management
  - **account-detail.md** - View, copy, edit, delete account
  - **account-edit.md** - Create/edit with template picker
  - **settings.md** - Security, UI, Data, Autofill sections
  - **templates.md** - Template CRUD, builtin templates
- **capacitor-plugins/**
  - **kiyautofill.md** - Autofill status, enable request, account sync, bridge to AutofillPlatformBridge and AutofillSyncManager
  - **kiyosecurekey.md** - Biometric key storage for React vault unlock
  - **kiyofile.md** - File save/open/read/write operations, plugin registration, and usage

### 4. android/ (Kotlin Native)
- **application.md** - Application entry points (KiyoApplication.kt, MainActivity.java)
- **autofill-service/**
  - **service-overview.md** - KiyoAutofillService lifecycle, onFillRequest, onSaveRequest
  - **field-detection.md** - ViewNode traversal, scoring, username/password field detection
  - **credential-extraction.md** - Extracting values from detected fields
  - **fill-response.md** - Dataset creation, SaveInfo, auth response
  - **auth-handler.md** - DatabaseKeyManager integration, UserNotAuthenticatedException flow
  - **settings.md** - Activity to enable/disable autofill service and configure settings
  - **icon.md** - Icon fetching, caching, and usage in autofill suggestions
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
  - **kiyautofill-plugin.md** - Bridge to React, service status, account sync (includes AutofillPlatformBridge and AutofillSyncManager)
  - **securekey-plugin.md** - Bridge to React, biometric key store/unlock/delete
  - **kiyofile-plugin.md** - Bridge to React, file save/open/read/write operations

### 5. data-models/
- **vault.md** - KiyoVaultData, EncryptedKiyoVaultData
- **account.md** - Account, AccountField, FieldType, AppSettings
- **template.md** - Template, TemplateField, DEFAULT_TEMPLATE_FIELDS
- **file-metadata.md** - FileRecord, FileMetadata
- **website-presets.md** - Website preset data for domain matching and autofill
- **builtin-templates.md** - Built-in template definitions for quick account creation
- **icons.md** - Icon mapping constants and usage
- **dev-accounts.md** - Development accounts data for testing

### 6. testing/
- **unit-tests.md** - Vitest setup, crypto tests, database integration tests
- **e2e-tests.md** - Playwright configuration, test scenarios
- **android-tests.md** - JUnit tests for DomainMatcher, FieldScoringRules, AuthRequestHandler
- **autofill-test-login.md** - AutofillTestLogin.tsx page for testing autofill functionality
- **test-setup.md** - Test configuration, fixtures, helpers, and mocks

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
- [x] Error handling (FileStorageError)
- [x] Components: Button, AutoLockIndicator, BottomTabs, icons, dialogs
- [x] Hooks: useAutoLock, useFileAuthGuard, useClipboard, useAndroidBackButton
- [x] Pages: auth, home, accounts, account-detail, account-edit, settings, templates
- [x] Capacitor plugins: kiyautofill, kiyosecurekey, kiyofile

### Android (Kotlin Native)
- [x] Application entry points (KiyoApplication.kt, MainActivity.java)
- [x] Autofill service: service overview, field detection, credential extraction, fill response, auth handler, settings, icon
- [x] Repository: autofill operations, database helper, domain matching
- [x] Security: keystore manager, database key manager, secure key manager, biometric auth, encrypted key
- [x] Capacitor plugins: kiyautofill-plugin (includes AutofillPlatformBridge and AutofillSyncManager), securekey-plugin

### Data Models
- [x] Vault data models
- [x] Account data models
- [x] Template data models
- [x] File metadata
- [x] Website presets
- [x] Built-in templates

### Testing
- [x] Unit tests (Vitest)
- [x] E2E tests (Playwright)
- [x] Android tests (JUnit)
- [x] Autofill test login page