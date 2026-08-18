---
type: detail
title: useAndroidBackButton Hook
description: A React hook that handles Android hardware back button presses using Capacitor's App plugin, navigating back in history or exiting the app.
tags: [frontend, hook, android, capacitor, navigation]
openwiki:
  roles: [frontend]
  change_kinds: [lifecycle]
  source_paths: [src/hooks/useAndroidBackButton.ts]
  symbols: [useAndroidBackButton]
  test_paths: []
  invariants: ["Only active on Android platform", "Navigates back if history length > 1, otherwise exits app"]
  validation_commands: ["npm run test"]
---

# useAndroidBackButton Hook

The `useAndroidBackButton` hook is a custom React hook that listens for Android hardware back button events and handles them appropriately: navigating back in the browser history if possible, or exiting the app if at the root.

## Source File

- `/src/hooks/useAndroidBackButton.ts`

## Purpose

This hook provides Android-native back button behavior in the KIYO app. On Android devices, pressing the hardware back button should:
1. Navigate back in the app's history if there are previous pages (`window.history.length > 1`)
2. Exit the app entirely if at the first/root page

## Implementation

```typescript
import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import type { PluginListenerHandle } from '@capacitor/core';

const useAndroidBackButton = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Only add the listener on Android
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    const handler = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        App.exitApp();
      }
    };

    let listener: PluginListenerHandle | null = null;

    App.addListener('backButton', handler).then(l => {
      listener = l;
    });

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [navigate]);
};

export default useAndroidBackButton;
```

## Key Behaviors

| Scenario | Behavior |
|----------|----------|
| Platform is not Android | Hook does nothing (early return) |
| History length > 1 | Calls `navigate(-1)` to go back one page |
| History length = 1 | Calls `App.exitApp()` to close the app |
| Component unmounts | Removes the back button listener |

## Usage

The hook is used in the root `App.tsx` component via a dedicated wrapper component:

```tsx
// In src/App.tsx
function AndroidBackButtonHandler() {
  useAndroidBackButton();
  return null;
}

function App() {
  // ... existing code ...

  return (
    <BrowserRouter>
      <AndroidBackButtonHandler />  // Added here
      <Routes>
        {/* routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

This pattern ensures:
- The hook runs at the top level of the React tree
- It has access to the `useNavigate` hook from `react-router-dom`
- It doesn't render any UI (returns `null`)

## Dependencies

- `@capacitor/app` - For `App.exitApp()` and `App.addListener('backButton', ...)`
- `@capacitor/core` - For `Capacitor.getPlatform()`
- `react-router-dom` - For `useNavigate()`

## Platform Behavior

| Platform | Behavior |
|----------|----------|
| Android | Listens for hardware back button, navigates or exits |
| iOS | No hardware back button; hook returns early |
| Web (browser) | No hardware back button; hook returns early |

## Testing

There are currently no dedicated unit tests for this hook. The hook is tested implicitly through E2E tests that verify Android back button behavior.

To add tests:
1. Mock `@capacitor/app` and `@capacitor/core`
2. Test the handler logic for both history length scenarios
3. Verify listener cleanup on unmount

## Related Documentation

- [Architecture Overview](/openwiki/architecture/overview.md) - System architecture including Capacitor bridge
- [Capacitor Plugins Overview](/openwiki/android/capacitor-plugins/index.md) - Overview of all Capacitor plugins
- [Frontend Hooks Overview](/openwiki/frontend/hooks/) - Other available hooks