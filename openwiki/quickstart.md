---
type: quickstart
title: KIYO Wiki Quickstart
description: High-level introduction to the KIYO repository wiki, providing navigation guidance and task-routing for common development activities.
tags: [quickstart, navigation]
---

# KIYO Wiki Quickstart

This wiki provides comprehensive documentation for the KIYO repository, an offline-first Android password manager with system-level autofill integration. Use this guide to navigate the documentation and find information for specific development tasks.

## Repository Overview

KIYO is a hybrid application combining:
- **React frontend** (TypeScript, Vite, Tailwind CSS) for the user interface
- **Android native layer** (Kotlin) for autofill service and secure storage
- **Capacitor bridge** for communication between web and native layers
- **Local storage** using IndexedDB (Dexie.js) for frontend data and SQLCipher for autofill credentials

## Navigation Guide

Use the table below to find documentation based on your development intent:

| Intent / Change Area | Relevant Wiki Page(s) | Key Entrypoints / Symbols | Focused Tests | Validation Command |
|----------------------|------------------------|----------------------------|---------------|---------------------|
| Understanding overall architecture | `/openwiki/architecture/overview.md` | `src/main.tsx`, `src/App.tsx` | N/A | `npm run build` |
| Modifying UI pages (Home, Accounts, Settings) | `/openwiki/frontend/pages/` | `src/pages/` directory | `src/pages/**/*.test.tsx` | `npm run test` |
| Adding/editing account fields or templates | `/openwiki/frontend/pages/templates/`<br>`/openwiki/models/` | `src/models/`<br>`src/pages/Templates/` | `src/database/templateTable.integration.test.ts` | `npm run test -- --reporter verbose template` |
| Changing autofill behavior or Android integration | `/openwiki/android/` | `android/app/src/main/java/com/kiyo/app/autofill/`<br>`src/plugins/` | `android/app/src/androidTest/` | `npm run test:e2e` |
| Updating cryptographic operations or key management | `/openwiki/crypto/`<br>`/openwiki/android/database/database-key-manager.md` | `src/crypto/`<br>`android/app/src/main/java/com/kiyo/app/autofill/repository/` | `src/crypto/**/*.test.ts`<br>`src/database/fileStorage.encryption.integration.test.ts` | `npm run test -- --reporter verbose crypto` |
| Modifying state management (Zustand stores) | `/openwiki/frontend/state/` | `src/store/` directory | `src/store/**/*.test.ts` | `npm run test` |
| Adding new UI components or hooks | `/openwiki/frontend/components/`<br>`/openwiki/frontend/hooks/` | `src/components/`<br>`src/hooks/` | `src/components/**/*.test.tsx`<br>`src/hooks/**/*.test.ts` | `npm run test` |
| Android back button handling | `/openwiki/frontend/hooks/use-android-back-button.md` | `src/hooks/useAndroidBackButton.ts` | N/A | `npm run test:e2e` |
| Changing error handling or file storage operations | `/openwiki/errors/file-storage-error.md`<br>`/openwiki/database/file-storage.md` | `src/errors/FileStorageError.ts`<br>`src/database/fileStorage.ts` | `src/database/fileStorage*.integration.test.ts` | `npm run test` |
| Updating build configuration or dependencies | `/openwiki/operations/build.md` | `vite.config.ts`<br>`android/` Gradle files | N/A | `npm run build` |
| CI/CD pipeline changes | `/openwiki/operations/ci-cd.md` | `.github/workflows/ci.yml` | N/A | `npm run typecheck && npm run lint && npm run test && npm run build` |
| Modifying environment variables or configuration | `/openwiki/operations/build.md` | `vite.config.ts`<br>`capacitor.config.ts` | N/A | `npm run dev` |

## Key Entry Points

- **Application bootstrap**: `/src/main.tsx` - React root rendering
- **Root application**: `/src/App.tsx` - Routing, providers, top-level layout, and Android back button handler
- **Autofill service entry**: `/android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt`
- **Capacitor plugin registration**: `/src/plugins/kiyautofill.ts` (Android) and `.web.ts` (web)
- **Database initialization**: `/src/database/db.ts` - Dexie schema and instance

## Common Development Tasks

### Adding a new account field type
1. Define field type in `/src/models/fieldTypes.ts`
2. Add to built-in templates in `/src/data/builtinTemplates.ts` if applicable
3. Update template store in `/src/store/templateStore.ts` if needed
4. Ensure UI components handle the new field type (AccountEdit, TemplateEdit)
5. Add tests in `/src/database/templateTable.integration.test.ts`

### Modifying autofill behavior
1. Identify relevant autofill submodule in `/android/app/src/main/java/com/kiyo/app/autofill/` (e.g., detection, credential, repository)
2. Modify Kotlin implementation
3. Update Capacitor plugin interface if needed in `/src/plugins/`
4. Update frontend usage in `/src/pages/AutofillTestLogin.tsx` or stores
5. Run E2E tests: `npm run test:e2e`

### Changing encryption parameters
1. Review `/src/crypto/encryption.ts` for low-level crypto
2. Check `/src/crypto/recordEncryption.ts` for record-level operations
3. Verify Android KeyStore integration in `/openwiki/android/database/database-key-manager.md`
4. Run crypto tests: `npm run test -- --reporter verbose crypto`
5. Verify file storage tests still pass

### Adding a new settings option
1. Add setting definition in `/src/store/settingsStore.ts`
2. Update Settings UI in `/src/pages/Settings/` directory
3. Persist setting via `initialize*` functions in `App.tsx`
4. Ensure setting is retrieved and used in relevant components
5. Add unit tests for settings store

### Modifying Android back button behavior
1. Locate the hook at `/src/hooks/useAndroidBackButton.ts`
2. Modify the handler logic for navigation vs. exit conditions
3. Test on Android device/emulator with hardware back button
4. Run E2E tests: `npm run test:e2e`

## Getting Help

- Examine test files for usage patterns and edge cases
- Check git history for recent changes and rationale
- Look for TODO comments in source code for known issues
- Run `npm run lint` to catch code style issues
- Use `npm run typecheck` to verify TypeScript safety

---