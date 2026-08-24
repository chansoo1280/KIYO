---
type: detail
title: useAutoLock Hook
description: A React hook that manages the auto-lock timer with activity detection for KIYO vault sessions.
tags: [frontend, hook, auto-lock, session, security]
---

# useAutoLock Hook

The `useAutoLock` hook manages the auto-lock timer for vault sessions. It handles configurable timeout periods, user activity detection (click, keydown, touch, scroll), and automatically locks the vault when the timer expires.

## Source File

- `/src/hooks/useAutoLock.ts`

## Purpose

This hook implements the auto-lock security feature that automatically locks the vault after a period of inactivity. It:
- Reads the auto-lock timeout setting from the settings store (none, 1m, 10m, 30m)
- Monitors the session store for the presence of a `cryptoKey` (indicating an unlocked vault)
- Starts a countdown timer when the vault is unlocked
- Resets the timer on user activity events
- Calls `lockDataFile()` to lock the vault when the timer reaches zero
- Exposes `remainingSeconds` for UI display (e.g., `AutoLockIndicator` component)

## Interface

### Parameters

The hook takes no parameters. It reads configuration from Zustand stores internally.

### Return Value

Returns an object with:

| Property | Type | Description |
|----------|------|-------------|
| `remainingSeconds` | `number` | Seconds remaining until auto-lock triggers. `0` when disabled or locked. |
| `startTimer` | `() => void` | Manually start/restart the timer (used by activity detection). |
| `stopTimer` | `() => void` | Manually stop the timer and reset state. |

## Configuration

The timeout values are defined in `TIMEOUT_MAP` (in `/src/hooks/useAutoLock.ts`):

```typescript
const TIMEOUT_MAP: Record<AutoLockTimeout, number> = {
  none: 0,
  "1m": 60,
  "10m": 600,
  "30m": 1800,
};
```

These correspond to the `autoLockTimeout` setting in `/src/store/settingsStore.ts`.

## Implementation Details

### Timer Management

The hook uses multiple `useRef` values to track timer state without triggering re-renders:
- `timerRef` - The active `setInterval` reference
- `timeoutRef` - Current countdown value (mutable, not state)
- `isActiveRef` - Whether timer is currently counting down
- `startedRef` - Whether timer has been started at least once
- `lockedRef` - Whether the vault has been locked (prevents restart)

### Effect Dependencies

1. **Timer tick effect** (`tick` callback) - Runs every second via `setInterval`, decrements `timeoutRef`, updates `remainingSeconds` state, and calls `lockDataFile()` when reaching zero.

2. **Settings/session change effect** - Restarts timer when `autoLockTimeout` or `cryptoKey` changes. Clears existing timer first. Respects `lockedRef` to prevent restart after lock.

3. **Activity detection effect** - Adds event listeners for `click`, `keydown`, `touchstart`, `scroll` (passive). On activity, resets `timeoutRef` to full timeout value and updates `remainingSeconds`. Only active when `isActiveRef.current` is true and timeout is not "none".

4. **Cleanup effect** - Clears interval on unmount.

### Lock Flow

When timer expires:
1. `tick` clears the interval
2. Sets `isActiveRef.current = false`, `startedRef.current = false`, `lockedRef.current = true`
3. Sets `remainingSeconds = 0`
4. Calls `lockDataFile()` which:
   - Clears the `cryptoKey` from `sessionStore`
   - Clears the `activeFileName` from `fileTable`
   - Triggers navigation to auth page via `useFileAuthGuard` on protected routes

## Usage

The hook is used in `/src/App.tsx`:

```tsx
import { useAutoLock } from "./hooks/useAutoLock";

function App() {
  const { remainingSeconds } = useAutoLock();
  
  // ... initialization effects ...
  
  return (
    <BrowserRouter>
      <AndroidBackButtonHandler />
      <Routes>...</Routes>
      <AutoLockIndicator remainingSeconds={remainingSeconds} />
    </BrowserRouter>
  );
}
```

The `AutoLockIndicator` component (in `/src/components/AutoLockIndicator.tsx`) displays the remaining time in the UI.

## Key Invariants

- **Timer only runs when vault is unlocked** - Requires `cryptoKey` in session store
- **Timer respects "none" setting** - `autoLockTimeout === "none"` disables timer entirely
- **Activity resets to full timeout** - Not incremental; resets to configured timeout value
- **Locked state is sticky** - Once `lockedRef.current = true`, timer will not restart until `cryptoKey` becomes non-null again (user re-authenticates)
- **Cleanup on unmount** - Interval cleared to prevent memory leaks

## Testing

The hook's behavior can be tested by:
1. Mocking `useSettingsStore` and `useSessionStore` to return different timeout/key states
2. Advancing fake timers (e.g., `jest.useFakeTimers()` or `vi.useFakeTimers()`)
3. Verifying `lockDataFile` is called after the expected timeout
4. Verifying activity events reset the timer

## Related Documentation

- [AutoLockIndicator component](/openwiki/frontend/components/)
<!-- openwiki: broken internal link [/openwiki/frontend/state-management.md#session-store] file "/openwiki/frontend/state-management.md" does not exist. Fix the href or restore the target, then delete this comment. -->
- [Session store](/openwiki/frontend/state-management.md#session-store)
<!-- openwiki: broken internal link [/openwiki/frontend/state-management.md#settings-store] file "/openwiki/frontend/state-management.md" does not exist. Fix the href or restore the target, then delete this comment. -->
- [Settings store - autoLockTimeout](/openwiki/frontend/state-management.md#settings-store)
<!-- openwiki: broken internal link [/openwiki/database/file-storage.md] file "/openwiki/database/file-storage.md" does not exist. Fix the href or restore the target, then delete this comment. -->
- [File storage - lockDataFile](/openwiki/database/file-storage.md)
- [Security model - auto-lock](/openwiki/architecture/security-model.md#session-management)