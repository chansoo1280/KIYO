---
type: reference
title: Unit Tests (Web)
description: Vitest unit and integration suites covering crypto, stores, file storage, sync queue, and static-analysis regression.
tags: [testing, unit, integration, vitest, web]
---

# Unit Tests (Web)

Vitest unit and integration suites live alongside the source files in `/src/`.

## Crypto

- `src/crypto/encryption.test.ts` — `createCryptoKey`, `encryptData`, `decryptData`, `verifyPin`, `importKey`/`exportKey`.
- `src/crypto/recordEncryption.test.ts` — `createEncryptedRecord`, `createPlaintextRecord`, `decryptRecord`.
- `src/crypto/crypto.utils.test.ts` — `toBase64`, `fromBase64`, `secureContextAvailable`.
- `src/crypto/pinStrength.test.ts` — PIN strength scoring (`@zxcvbn-ts/core` integration).

## Stores

- `src/store/settingsStore.test.ts` — partialize contract, `initializeTheme`, `initializeFontSize`, `initializeAutoLockTimeout`.

## Hooks

- `src/hooks/useAutoLock.test.tsx` — timer reset on activity, lockDataFile on timeout.
- `src/hooks/useFileAuthGuard.test.tsx` — three-branch routing (no active file / encrypted+no key / pass).

## Pages

- `src/pages/Home.test.tsx` — empty state, file list rendering, navigation to /create-vault and /auth.
- `src/pages/RootRedirect.test.tsx` — 4-state machine (checking/preloading/redirecting/error), preload orchestration.
- `src/pages/Accounts/AccountList.test.tsx` — search/filter/sort, AND-tag filter.
- `src/pages/Accounts/AccountDetail.test.tsx` — copy-to-clipboard, navigate to /edit.
- `src/pages/Accounts/AccountEdit/AccountEdit.test.tsx` — form fields, save flow.
- `src/pages/Accounts/components/TemplatePicker.test.tsx` — built-in + custom template list.
- `src/pages/CreateVault/CreateVaultPage.test.tsx` — multi-step flow (NameStep, PinStep).
- `src/pages/CreateVault/steps/NameStep.test.tsx`, `PinStep.test.tsx`.
- `src/pages/CreateVault/components/Stepper.test.tsx`.
- `src/pages/Templates/TemplateEdit/index.test.tsx` — field editor, icon picker.

## Components

- `src/components/Button.test.tsx` — variant + disabled.
- `src/components/PageHeader.test.tsx`, `PageShell.test.tsx`.
- `src/components/SettingsRow.test.tsx`, `SettingsSection.test.tsx`.
- `src/components/SplashScreen.test.tsx`, `ErrorScreen.test.tsx`, `SyncErrorBanner.test.tsx`.
- `src/components/PasswordField.test.tsx`, `FieldCard.test.tsx`.
- `src/components/inputs/Input.test.tsx`, `Checkbox.test.tsx`, `PinStrengthMeter.test.tsx`.
- `src/components/feedback/ErrorMessage.test.tsx`, `Spinner.test.tsx`.
- `src/components/dialogs/BaseDialog.test.tsx`, `ConfirmDialog.test.tsx`, `FileDialogs.test.tsx`, `FormDialog.test.tsx`.

## Database

- `src/database/accountTable.integration.test.ts` — CRUD with cryptoKey.
- `src/database/templateTable.integration.test.ts` — CRUD with cryptoKey.
- `src/database/fileTable.integration.test.ts` — multi-vault, resolveFileName `(N)` dedup.
- `src/database/fileStorage.test.ts` — pure unit tests of helpers.
- `src/database/fileStorage.lifecycle.integration.test.ts` — full createDataFile → unlockFile → changePin → closeDataFile.
- `src/database/fileStorage.encryption.integration.test.ts` — round-trip encryption.
- `src/database/fileStorage.changePin.integration.test.ts` — changePin re-encryption.
- `src/database/fileStorage.error.integration.test.ts` — error mapping.

## Utils

- `src/utils/mapError.test.ts` — `mapError` mappings (`PIN_MISMATCH`, `INVALID_FORMAT`, `FILE_READ_FAILED`, etc.).

## Static-Analysis Regression

- `src/App.simple.test.tsx` — reads `/src/App.tsx` as a string and asserts that the file does not call `useEffect`/`loadAccounts`/`loadTemplates`. This regression-gates the move of preload orchestration from `App.tsx` into `RootRedirect`. Removing this test would allow `App.tsx` to silently re-introduce a second `loadAccounts()` call that breaks the store-side `initialized` guard.

## Source Anchors

- `src/**/*.test.ts(x)` — all test files.