---
type: page
title: Settings Page
description: Settings index + SecuritySection, UISection, DataSection, AutofillSection. AppInfoDialog and PinChangeDialog are modal sub-flows.
tags: [page, settings, security, ui, data, autofill]
---
# Settings Page
Source File: /src/pages/Settings/index.tsx
Route: /settings
Responsibility
Renders top-level settings sections. Each section is its own React component under /src/pages/Settings/components/.
Sections
- SecuritySection - biometric enrollment (KiyoSecureKey.storeKey / deleteKey / hasKey), PIN change (PinChangeDialog), auto-lock timeout.
- UISection - theme (light/dark/system) and font size.
- DataSection - backup (exportBackupFile), auto-backup (pickBackupFolder + settings), restore (importBackupFile), factory reset (clear all + reload).
- AutofillSection - autofill enabled toggle (syncs with native via KiyoAutofill), open Android autofill settings (openAutofillSettings).
Sub-Components
- AppInfoDialog - version, licenses, repo link.
- PinChangeDialog - re-encrypt vault with a new PIN (fileStorage.changePin).
Focused Tests
- src/pages/Settings/components/* tests cover each section in isolation.
- src/store/settingsStore.test.ts covers persisted settings + partialize contract.
Source Anchors
- Page: /src/pages/Settings/index.tsx
- Security: /src/pages/Settings/components/SecuritySection.tsx
- UI: /src/pages/Settings/components/UISection.tsx
- Data: /src/pages/Settings/components/DataSection.tsx
- Autofill: /src/pages/Settings/components/AutofillSection.tsx
- Pin change: /src/pages/Settings/components/PinChangeDialog.tsx
- App info: /src/pages/Settings/components/AppInfoDialog.tsx