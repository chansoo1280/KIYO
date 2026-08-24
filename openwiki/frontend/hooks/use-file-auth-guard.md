---
type: detail
title: useFileAuthGuard Hook
description: A React hook that guards routes based on file authentication status in KIYO.
tags: [frontend, hook, authentication, file-operations]
---

# useFileAuthGuard Hook

The `useFileAuthGuard` hook is a custom React hook that protects routes by checking the current file authentication status. It redirects the user to the appropriate page if no file is active or if the file is encrypted but the crypto key is not available (locked state).

## Source File
- `/src/hooks/useFileAuthGuard.ts`

## Purpose
This hook is used in components that require an active, decrypted vault file to function (e.g., the Accounts page, Templates page). It ensures that:
- If no vault file is active, the user is redirected to the home page (or a custom handler is called).
- If a vault file is active but encrypted and the crypto key is not available (meaning the user needs to enter their PIN), the user is redirected to the auth page (or a custom handler is called).

## Interface

### Parameters
The hook accepts an options object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `onNoFile` | `() => void` (optional) | Callback to execute when no active file is found. If not provided, the hook will redirect to the home page. |
| `onLocked` | `() => void` (optional) | Callback to execute when the file is encrypted but the crypto key is not available (locked state). If not provided, the hook will redirect to the auth page. |
| `skipRedirect` | `boolean` (default: `false`) | If set to `true`, the hook will not perform any redirects and will only call the provided callbacks (`onNoFile` and/or `onLocked`). |

### Return Value
The hook does not return any value. It performs its checks and redirects (or calls callbacks) as a side effect in a `useEffect`.

## Implementation Details

### How It Works
1. The hook uses `useEffect` to run the check on mount and when dependencies change.
2. It calls `fileTable.getActiveFileInfo()` to get the currently active file's name and whether it is encrypted.
3. It uses `useSessionStore.getState()` to get the current `cryptoKey` from the session store.
4. Based on the results:
   - If there is no active file name (`activeFileName === null`), it considers the state as "no file".
   - If the file is encrypted (`encrypted === true`) and there is no crypto key (`cryptoKey === null`), it considers the state as "locked".
5. In the "no file" state:
   - If `onNoFile` is provided, it is called.
   - Otherwise, if `skipRedirect` is false, the user is redirected to the home page (`/`).
6. In the "locked" state:
   - If `onLocked` is provided, it is called.
   - Otherwise, if `skipRedirect` is false, the user is redirected to the auth page (`/auth`).
7. If an error occurs while checking the file info, it is logged to the console but no redirect is performed (to avoid breaking the app on transient errors).

### Cleanup
The hook uses a `mounted` flag to avoid state updates on unmounted components, which is a common practice in React hooks that perform async operations.

## Usage Examples

### Basic Usage (with redirects)
```typescript
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";

function AccountsPage() {
  // This will redirect to / if no file is active, or to /auth if file is locked.
  useFileAuthGuard();

  // Rest of the component (will only render if file is active and decrypted)
  return <div>Accounts Page Content</div>;
}
```

### Usage with Custom Handlers
```typescript
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";
import { useShowToast } from "@/hooks/useShowToast"; // Example custom hook

function SettingsPage() {
  const showToast = useShowToast();

  useFileAuthGuard({
    onNoFile: () => showToast("No vault file is active. Please create or open a vault."),
    onLocked: () => showToast("Vault is locked. Please enter your PIN to unlock."),
  });

  // Rest of the component
  return <div>Settings Page Content</div>;
}
```

### Usage with skipRedirect
```typescript
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";
import { useNavigate } from "react-router-dom";

function SomeComponent() {
  const navigate = useNavigate();

  useFileAuthGuard({
    skipRedirect: true,
    onNoFile: () => navigate("/files", { replace: true }), // Go to file manager instead of home
    onLocked: () => navigate("/auth", { replace: true }),   // Still go to auth for locked
  });

  // Component logic
  return <div>...</div>;
}
```

## Dependencies
- `react`: For `useEffect`.
- `react-router-dom`: For `useNavigate` to perform redirects.
- `@/database/fileTable`: To get the active file information.
- `@/store/sessionStore`: To get the current crypto key from the session store.

## Testing
The hook is tested in isolation by mocking the dependencies (`fileTable`, `sessionStore`, and `navigate`) and verifying:
- That it redirects to the home page when no file is active.
- That it redirects to the auth page when the file is encrypted but no crypto key is available.
- That it calls the provided callbacks when given.
- That it does not redirect when `skipRedirect` is true.
- That it handles errors gracefully (no redirect on error).

## Notes
- This hook is designed to be used at the top level of a route component or in a layout component that requires file authentication.
- It does not handle the actual authentication process (entering PIN to get the crypto key). That is handled elsewhere (e.g., in the Auth page and session store).
- The hook assumes that the `fileTable` and `sessionStore` are initialized and available when the hook runs.

---