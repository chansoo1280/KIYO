---
type: overview
title: System Architecture
description: High-level system architecture diagram, data flows, and component boundaries for KIYO Password Manager.
tags: [architecture, overview, diagram]
---
# System Architecture

KIYO is a hybrid Android application that combines a React/TypeScript frontend running in a Capacitor WebView with Kotlin native code for Android AutofillService and secure storage. The architecture follows a layered approach with clear separation of concerns between the web and native layers.

## Architecture Diagram

```mermaid
flowchart LR
    subgraph "React App (WebView)"
        A[React UI] --> B[Zustand Stores]
        B --> C[Dexie/IndexedDB]
        B --> D[Capacitor Plugins]
    end

    subgraph "Capacitor Bridge"
        D --> E[KiyoAutofill Plugin]
        D --> F[SecureKey Plugin]
        D --> G[KiyoFile Plugin]
    end

    subgraph "Android Native"
        E --> H[KiyoAutofillService]
        F --> I[SecureKeyManager]
        G --> J[File System Access]
        H --> K[AutofillRepository]
        I --> L[Biometric Auth Helper]
        K --> M[SQLCipher DB]
        L --> N[Android Keystore]
        M --> N
        J --> O[Encrypted Vault Files]
    end

    subgraph "File System"
        C --> O
    end

    subgraph "Android Keystore"
        N --> P[kiyo_master_key (AES-256-GCM)]
        N --> Q[kiyo_secure_master_key (AES-256-GCM)]
    end
```

## Component Boundaries

### 1. React Frontend (WebView)
- **Responsibility**: User interface, account management, template management, settings, local data storage
- **Technology Stack**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router
- **Local Storage**: IndexedDB via Dexie.js for vault data, templates, files, and settings
- **Communication**: Capacitor plugins for native functionality (autofill, secure key storage, file operations)

### 2. Capacitor Bridge
- **Responsibility**: Expose native functionality to the web layer through plugin interfaces
- **Plugins**:
  - `KiyoAutofill`: Manages autofill service status and account synchronization
  - `SecureKey`: Handles biometric-bound cryptographic key storage for React vault encryption
  - `KiyoFile`: Provides file system access for vault import/export operations

### 3. Android Native Layer
- **Responsibility**: System-level autofill service, secure credential storage, cryptographic operations
- **Technology Stack**: Kotlin, Android SDK, SQLCipher, Android Keystore, DataStore
- **Key Components**:
  - `KiyoAutofillService`: Processes fill and save requests from Android Autofill Framework
  - `AutofillRepository`: Manages SQLCipher database for autofill credentials
  - `KeystoreManager`: Manages two master keys in Android Keystore:
    - `kiyo_master_key`: Encrypts SQLCipher database for autofill credentials
    - `kiyo_secure_master_key`: Protects the React vault encryption key
  - `SecureKeyManager`: Stores and retrieves the React vault encryption key using biometric authentication
  - `DatabaseKeyManager`: Handles generation, encryption, and persistence of the SQLCipher database key (`DB_KEY`)

## Data Flows

### Vault Encryption Flow
1. User enters PIN/biometric to unlock vault
2. React layer requests vault decryption key from `SecureKey` plugin
3. `SecureKey` plugin retrieves encrypted key from `SecureKeyManager`
4. `SecureKeyManager` decrypts key using `kiyo_secure_master_key` from Keystore (after biometric auth)
5. Decrypted key returned to React layer for AES-GCM decryption of vault data

### Autofill Credential Flow
1. Autofill service receives fill/save request
2. Service queries `AutofillRepository` for matching credentials
3. Repository decrypts credentials using `DB_KEY` from `DatabaseKeyManager`
4. `DatabaseKeyManager` retrieves and decrypts `DB_KEY` using `kiyo_master_key` from Keystore
5. Credentials returned to autofill service for injection into app

### File Storage Flow
1. User exports/imports vault file via UI
2. Frontend calls `KiyoFile` plugin for file operations
3. Plugin delegates to native file system access (Android) or web fallback
4. Exported files are encrypted vault data; imported files are decrypted and stored in IndexedDB

## Security Boundaries

- **React Layer**: Never handles raw cryptographic keys; only receives encrypted data blobs
- **Capacitor Plugins**: Handle key material but only in encrypted form (except during brief decryption in secure environment)
- **Android Keystore**: Master keys never leave the Secure Hardware Environment (TEE/StrongBox)
- **Memory Protection**: Decrypted keys held in memory only as long as necessary and zeroed after use

## Lifecycle and Initialization

1. **App Start**:
   - React layer loads via `main.tsx` → `App.tsx`
   - Zustand stores initialize and load persisted data from IndexedDB
   - Capacitor plugins register and check native availability

2. **Vault Unlock**:
   - User authenticates via PIN/biometric
   - React requests decryption key via `SecureKey` plugin
   - Plugin coordinates with `SecureKeyManager` and Keystore
   - Decrypted key used to unlock vault data in IndexedDB

3. **Autofill Availability**:
   - Autofill service checks if enabled via `AutofillSettingsActivity`
   - Service status reported to React layer via `KiyoAutofill` plugin
   - React layer can request enable/disable through plugin interface

## Cross-Layer Communication

- **React → Native**: Capacitor plugin method calls (e.g., `KiyoAutofill.isEnabled()`)
- **Native → React**: Plugin callback results and event listeners (e.g., autofill status changes)
- **Data Exchange**: Encrypted blobs for vault/file operations; simple types for status/configuration

## Source

- Primary entry points: `/src/main.tsx`, `/src/App.tsx`
- Android service: `/android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt`
- Capacitor plugins: `/src/plugins/` and corresponding Android Java/Kotlin implementations