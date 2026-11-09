---
type: page
title: Home Page
description: Vault file dashboard. Lists existing vault files; supports open, close, create, import, export.
tags: [page, home, vault, file]
---
# Home Page
Source File: /src/pages/Home.tsx
Route: /home
Responsibility
- Lists all vault files from fileTable.getAllFiles (using fileName as PK since v14).
- Per-row actions: Open (sets activeFileName + locks / loads cryptoKey), Close (clearSession), Delete (not present in current UI; reserved for future).
- Bulk actions: Create new vault (navigates to /create-vault), Import vault file, Export active vault.
State and Hooks
- useState for modal state (FileCreateDialog, FileOpenDialog).
- useNavigate for cross-page navigation.
- useFileAuthGuard is **not** used here because Home is the pre-vault-selection screen; the guard's no-active-file branch would just bounce back.
Focused Tests
- src/pages/Home.test.tsx covers rendering, "open file" → setSession + initializeStores, "import" → openImportedDataFile, "create" navigation.
Source Anchors
- Page: /src/pages/Home.tsx
- File table: /src/database/fileTable.ts
- File create dialog: /src/components/dialogs/FileCreateDialog.tsx
- File open dialog: /src/components/dialogs/FileOpenDialog.tsx