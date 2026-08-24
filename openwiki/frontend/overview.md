---
type: overview
title: Frontend Application Overview
description: Overview of the React frontend structure, state management, and entrypoints (main.tsx, App.tsx).
tags: [frontend, react, zustand]
---

# Frontend Application Overview

The KIYO frontend is a React application built with TypeScript and Vite, designed to run in a Capacitor-powered WebView on Android. It provides the user interface for managing passwords, settings, and application data while leveraging Zustand for state management and IndexedDB (via Dexie.js) for persistence.

## Entrypoints

### Main Entry Point (`src/main.tsx`)
- Bootstraps the React application with `StrictMode` for development safety
- Injects global CSS (`src/index.css`)
- Renders the `<App />` component into the DOM root
- This is the first file executed when the web application starts

### Root Application (`src/App.tsx`)
- Sets up client-side routing with `react-router-dom`
- Configures routes for all application pages:
  - `/` - Home page
  - `/auth` - Authentication (PIN/biometric setup)
  - `/accounts` - Account list and management
  - `/settings` - Application settings
  - `/autofill-test` - Autofill testing utility
  - `/templates` - Field template management
- Initializes application state via Zustand store hooks:
  - `loadAccounts()` - Loads encrypted account data from IndexedDB
  - `loadTemplates()` - Loads field templates
  - `initializeTheme()` - Applies saved theme preference
  - `initializeFontSize()` - Applies saved font size setting
  - `initializeAutoLockTimeout()` - Configures auto-lock duration
- Integrates cross-cutting concerns:
  - `<AndroidBackButtonHandler />` - Handles Android system back button
  - `<AutoLockIndicator />` - Visual countdown for session timeout
- Wraps application in `<BrowserRouter>` for routing functionality

## State Management

The frontend uses Zustand for state management, with separate stores for different domains:

- **Account Store** (`src/store/accountStore.ts`): Manages account data (CRUD operations, encryption/decryption, loading from DB)
- **Template Store** (`src/store/templateStore.ts`): Manages field templates for account creation
- **Settings Store** (`src/store/settingsStore.ts`): Manages user preferences (theme, font size, auto-lock timeout)
- **Session Store** (`src/store/sessionStore.ts`): Manages session state (auto-lock timer, locked/unlocked state)

Stores follow a consistent pattern:
- State defined as TypeScript interfaces
- Actions as functions that modify state
- Subscriptions to persist changes to IndexedDB
- Selectors for deriving computed values
- Initialization functions called from `App.tsx`

## Data Persistence

Frontend data is persisted using IndexedDB via Dexie.js:
- Database schema defined in `src/database/db.ts`
- Tables for accounts, templates, and encrypted file vaults
- Stores automatically sync with database on state changes
- Encryption/decryption handled at the store layer using crypto utilities
- Database versioning handled in `src/database/db.ts`

## UI Structure

Pages are organized in `src/pages/`:
- **Home** (`src/pages/Home.tsx`): Dashboard showing account statistics and quick actions
- **Accounts** (`src/pages/Accounts/`): Account list, detail, and edit views
- **Settings** (`src/pages/Settings/`): Preference toggles and value selectors
- **Auth** (`src/pages/Auth.tsx`): PIN setup and biometric authentication
- **AutofillTestLogin** (`src/pages/AutofillTestLogin.tsx`): Test utility for autofill service
- **Templates** (`src/pages/Templates/`): Template list and edit views

Components are organized in `src/components/`:
- **Shared UI**: Buttons, tabs, icons, dialogs
- **Layout**: Bottom navigation, auto-lock indicator
- **Forms**: Reusable form elements and validation

## Build and Development

- **Development Server**: `npm run dev` - Vite dev server with hot module replacement
- **Production Build**: `npm run build` - Vite builds optimized assets to `/dist`
- **Preview**: `npm run preview` - Serves built assets for testing
- **Type Checking**: `npm run typecheck` - TypeScript compiler validation
- **Linting**: `npm run lint` - ESLint for code quality
- **Testing**: `npm run test` - Vitest for unit and integration tests

## Key Relationships

- Frontend communicates with Android native layer through Capacitor plugins:
  - `KiyoAutofill` plugin triggers autofill service
  - `KiyoSecureKey` plugin handles cryptographic operations requiring Android Keystore
- State stores subscribe to database changes to keep UI in sync
- Crypto utilities (`src/crypto/`) provide encryption primitives used by stores
- Utility functions (`src/utils/`) provide cross-cutting helpers (formatters, validators)

## Security Considerations

- **In-Memory Only**: Encryption keys exist only in memory; never persisted to disk
- **Secure Storage**: Sensitive data encrypted before IndexedDB storage
- **Session Management**: Auto-lock clears sensitive state from memory
- **XSS Protection**: React's automatic escaping combined with sanitization where needed
- **CSP**: Capacitor configuration restricts WebView to local assets only

---