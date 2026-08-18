---
type: detail
title: useClipboard Hook
description: A React hook for copying text to the clipboard with feedback on copy state and duration.
tags: [frontend, hook, clipboard, UI]
---

# useClipboard Hook

The `useClipboard` hook provides a simple way to copy text to the clipboard and receive feedback on whether the copy was successful and for how long the "copied" state should be displayed.

## Source File
- `/src/hooks/useClipboard.ts`

## Purpose
This hook encapsulates the async `navigator.clipboard.writeText` API and manages state to indicate:
- Whether the last copy operation was successful (`copied`).
- How many seconds remain until the copied state resets (`remainingTime`), typically set to 30 seconds.

## Interface

### Parameters
The hook takes no parameters.

### Return Value
Returns an object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `copy` | `(text: string) => Promise<boolean>` | Function to copy the given text to the clipboard. Returns a promise that resolves to `true` if successful, `false` otherwise. |
| `copied` | `boolean` | Indicates if the last copy operation was successful and the feedback period is active. |
| `remainingTime` | `number` | The number of seconds remaining in the feedback period. Counts down from 30 to 0 after a successful copy. |

## Implementation Details

### How It Works
1. The hook uses `useState` to track two pieces of state:
   - `copied`: boolean, initially `false`.
   - `remainingTime`: number, initially `0`.
2. The `copy` function is defined with `useCallback` (empty dependency array) to ensure referential equality across renders.
3. Inside `copy`:
   - It attempts to write the given text to the clipboard using `navigator.clipboard.writeText(text)`.
   - On success:
     - Sets `copied` to `true`.
     - Sets `remainingTime` to `30`.
     - Starts an interval that decrements `remainingTime` every second.
     - When `remainingTime` reaches `0`, the interval is cleared and `copied` is set back to `false`.
   - On failure (catch block), it returns `false`.
4. The function returns the result of the clipboard write operation (`true` on success, `false` on error).

### Cleanup
The interval is cleared automatically when the remaining time reaches zero. There is no additional cleanup needed in the hook itself, but if the component unmounts while the interval is running, it will be cleared when the remaining time hits zero (or could be improved with a cleanup effect, but the current implementation does not have one).

## Usage Examples

### Basic Usage
```typescript
import { useClipboard } from "@/hooks/useClipboard";

function CopyButton({ textToCopy }) {
  const { copy, copied, remainingTime } = useClipboard();

  return (
    <button onClick={() => copy(textToCopy)}>
      {copied ? `Copied! (${remainingTime}s)` : "Copy"}
    </button>
  );
}
```

### With Custom Feedback
```typescript
import { useClipboard } from "@/hooks/useClipboard";
import { useShowToast } from "@/hooks/useShowToast";

function PasswordItem({ password }) {
  const { copy } = useClipboard();
  const showToast = useShowToast();

  const handleCopy = async () => {
    const success = await copy(password);
    if (success) {
      showToast("Password copied to clipboard");
    } else {
      showToast("Failed to copy password");
    }
  };

  return <button onClick={handleCopy}>Copy Password</button>;
}
```

## Dependencies
- `react`: For `useCallback`, `useState`.
- Browser API: `navigator.clipboard` (requires HTTPS or localhost for security).

## Testing
The hook is tested in isolation by mocking `navigator.clipboard.writeText` and verifying:
- That calling `copy` with a text string resolves to `true` when the mock resolves.
- That the `copied` state becomes `true` and `remainingTime` is set to 30.
- That the interval decrements `remainingTime` and eventually resets the state.
- That calling `copy` returns `false` when the mock rejects.

## Notes
- The hook assumes the browser supports the Clipboard API. In environments where it is not available (e.g., older browsers, certain WebView configurations), the `copy` function will return `false`.
- The feedback duration is hardcoded to 30 seconds. If a different duration is needed, the hook would need to be modified or wrapped.
- The hook does not handle navigating away or component unmounting specially; the interval will continue to run in the background until it naturally ends. For most use cases this is acceptable, but if the component unmounts quickly, consider adding a cleanup effect to clear the interval.