---
type: component
title: FileOpenDialog
description: A dialog component for opening an existing vault file.
tags: [frontend, component, dialog, file-operations]
---

# FileOpenDialog

The `FileOpenDialog` component is a modal dialog that allows the user to open an existing vault file by selecting a file and providing a PIN if the file is encrypted.

## Source File
- `/src/components/dialogs/FileOpenDialog.tsx`

## Component Overview

The dialog manages the state for:
- Selecting a vault file from the device's file system.
- Displaying information about the selected file (name, location, encryption status).
- Entering a PIN for encrypted files.
- Validating that the selected file is a valid KIYO vault file.
- Confirming the file opening, which passes the file and PIN to a callback function.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `open` | boolean | Controls whether the dialog is open or closed. |
| `title` | string (optional) | The dialog title, defaults to "파일 열기" (Open File). |
| `onConfirm` | `(options: { file: File; pin: string }) => Promise<void>` | Callback function called when the user confirms opening the file. Receives the selected file and PIN. |
| `onClose` | `() => void` | Callback function called when the dialog is closed. |

## State
- `file`: The selected `File` object, or null if no file is selected.
- `pin`: The PIN entered for decrypting an encrypted file.
- `encrypted`: Boolean indicating whether the selected file is encrypted (based on file content inspection).

## Key Functions

### handleClose
Resets the dialog state (clears file, pin, encrypted flag, and file input) and calls the `onClose` prop.

### handleSubmit
Called when the user submits the form:
1. Prevents the default form submission.
2. Validates that a file is selected.
3. If the file is encrypted, validates that a PIN is entered.
4. Calls the `onConfirm` prop with the file and PIN.
5. Calls `handleClose` to reset the dialog.

### handleFileSelect
Called when the user selects a file:
1. Gets the selected file from the event.
2. Sets the file state.
3. Clears the PIN state.
4. Attempts to read the file as text and parse it as JSON to determine if it's encrypted.
5. Sets the `encrypted` state based on the `encrypted` property in the JSON.
6. If the file is not a valid KIYO file (invalid JSON or missing expected structure), sets `encrypted` to false and throws an error.

## UI Structure
- **Header**: Title (configurable via `title` prop) and close button (managed by `FormDialog`).
- **Body**:
  - File selection section:
    - Hidden file input (triggered by a button).
    - Button labeled "파일 선택" (Select File) that triggers the file input.
  - File information section (displayed after a file is selected):
    - File name.
    - Location (hardcoded to "내보낸 파일" - Exported File).
    - Encryption status (displayed as "사용" (Used) or "사용 안 함" (Not Used)).
  - PIN input section (conditionally displayed if file is encrypted):
    - Label: "PIN 번호" (PIN Number).
    - Password input with numeric input mode, max length 6, and placeholder "6자리 PIN".
- **Footer**: Managed by `FormDialog`, with a submit button labeled "열기" (Open) that is disabled when no file is selected.

## Usage
The dialog is used to open vault files for import. It is typically controlled by a state variable that tracks whether the dialog is open.

### Example Invocation
```typescript
import { useState } from "react";
import { FileOpenDialog } from "@/components/dialogs/FileOpenDialog";

function MyComponent() {
  const [isFileOpenDialogOpen, setIsFileOpenDialogOpen] = useState(false);

  const handleFileOpen = async ({ file, pin }) => {
    try {
      // Process the file and pin (e.g., decrypt and import vault)
      await importVault(file, pin);
    } catch (error) {
      // Handle error (e.g., show error dialog)
    }
  };

  return (
    <>
      <button onClick={() => setIsFileOpenDialogOpen(true)}>Open Vault</button>
      <FileOpenDialog
        open={isFileOpenDialogOpen}
        onConfirm={handleFileOpen}
        onClose={() => setIsFileOpenDialogOpen(false)}
      />
    </>
  );
}
```

## Dependencies
- `FormDialog`: Base class that provides the dialog structure and submit/close handling.
- React hooks: `useRef` for accessing the file input element, `useState` for managing dialog state.

## Testing
The component is tested in integration tests that:
- Mock the file selection process.
- Verify that the file information is displayed correctly.
- Test validation (requiring file selection, requiring PIN for encrypted files).
- Verify that the `onConfirm` callback is called with the correct parameters when submitted.
- Test that the dialog resets correctly when closed.

## Security Considerations
- The PIN is only used in memory to decrypt the vault file and is not stored.
- The component validates that the selected file is a valid KIYO vault file by attempting to parse it as JSON and checking for the expected structure.
- Error messages are generic to avoid leaking information about why a file is invalid (to prevent tampering attempts).
- The file input only accepts `.json` files, but the content is still validated to ensure it's a proper KIYO vault.