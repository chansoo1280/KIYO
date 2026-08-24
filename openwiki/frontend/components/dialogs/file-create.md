---
type: component
title: FileCreateDialog
description: A dialog component for creating a new encrypted vault file.
tags: [frontend, component, dialog, file-operations]
---

# FileCreateDialog

The `FileCreateDialog` component is a modal dialog that allows the user to create a new encrypted vault file by selecting accounts to export, setting a vault name, and providing a PIN for encryption.

## Source File
- `/src/components/dialogs/FileCreateDialog.tsx`

## Component Overview

The dialog extends `FormDialog` (a base class for form dialogs) and manages the state for:
- Selecting accounts to include in the vault (from the list of all accounts).
- Setting the vault name.
- Entering and confirming the PIN for encryption.
- Handling the file creation process, which involves:
  1. Deriving an encryption key from the PIN.
  2. Encrypting the selected accounts' data.
  3. Saving the encrypted data to a file in the app's documents directory.

## Props
The component does not take any props. It is controlled via state and callbacks from the `accountStore`.

## State
- `selectedAccounts`: Array of accounts selected for export.
- `vaultName`: The name for the new vault file.
- `pin`: The PIN entered for encryption.
- `confirmPin`: The PIN confirmation.
- `isExporting`: Boolean indicating if the export process is in progress.
- `error`: Any error message to display.

## Key Functions

### handleSelectAccounts
Called when the user selects accounts in the account picker. Updates `selectedAccounts`.

### handleCreateVault
Initiates the vault creation process:
1. Validates the vault name and PINs (must match).
2. Uses `accountStore.exporter` to get the encrypted vault data (this function handles the crypto).
3. Uses `fileStorage.saveVault` to write the encrypted data to a file.
4. On success, closes the dialog and may show a success toast.
5. On error, sets the error state to display a message.

### handleCancel
Closes the dialog without creating a vault.

## UI Structure
- **Header**: Title ("Create Vault") and close button.
- **Body**:
  - Account selection section (shows number of selected accounts, button to open picker).
  - Vault name input.
  - PIN input and confirmation.
  - Export button (disabled during process or if form invalid).
  - Error message display.
- **Footer**: Cancel and Export buttons.

## Usage
The dialog is opened from the Accounts page via the "Export" button in the header.

### Example Invocation
```typescript
import { FileCreateDialog } from "@/components/dialogs/FileCreateDialog";

// In a component's render function:
{isFileCreateDialogOpen && <FileCreateDialog onClose={() => setFileCreateDialogOpen(false)} /> }
```

## Dependencies
- `accountStore`: For exporting accounts (getting encrypted data).
- `fileStorage`: For saving the encrypted vault file.
- `useToast`: For showing success/error messages (if used).
- `useDialog`: Custom hook for managing dialog state (if used).

## Testing
The component is tested in integration tests that mock the store and file storage, simulating user interactions and verifying the export process.

## Security Considerations
- The PIN is used only to derive an encryption key and is not stored.
- The encrypted vault data is saved to a file that can only be decrypted with the same PIN.
- The component does not log or expose the PIN or decrypted data.

---