---
type: component
title: Frontend Application Structure
description: Entry points, routing, providers, and global state initialization for the React frontend.
tags: [frontend, structure, entrypoint, routing]
---
# Frontend Application Structure

The KIYO frontend is a React/TypeScript application built with Vite, running inside a Capacitor WebView on Android. It follows a standard React application structure with routing, state management, and service integration via Capacitor plugins.

## Entry Points

### Main Entry Point
- **File**: `/src/main.tsx`
- **Purpose**: Bootstrap the React application
- **Key Responsibilities**:
  - Create React root and render `<App />`
  - Register service workers (if applicable)
  - Set up error boundaries
  - Initialize global CSS and fonts

```typescript
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Root Application Component
- **File**: `/src/App.tsx`
- **Purpose**: Define application layout, routing, providers, and global initialization
- **Key Responsibilities**:
  - Set up client-side routing with `react-router-dom`
  - Initialize Zustand stores (load persisted data)
  - Configure theme, font size, and auto-lock settings from settings store
  - Handle Android back button behavior
  - Render global UI components (AutoLockIndicator)
  - Define route mappings for all pages

```typescript
function App() {
  // Load data from Zustand stores on initialization
  useEffect(() => {
    loadAccounts();
    loadTemplates();
    initializeTheme();
    initializeFontSize();
    initializeAutoLockTimeout();
  }, [loadAccounts, loadTemplates, initializeTheme, initializeFontSize, initializeAutoLockTimeout]);

  return (
    <BrowserRouter>
      <AndroidBackButtonHandler />
      <Routes>
        {/* Route definitions */}
      </Routes>
      <AutoLockIndicator remainingSeconds={remainingSeconds} />
    </BrowserRouter>
  );
}
```

## Routing Structure

The application uses `react-router-dom` for client-side routing with the following routes:

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `Home` | File dashboard (create/open/import vaults) |
| `/auth` | `Auth` | PIN/biometric unlock and file selection |
| `/accounts` | `AccountList` | View and search accounts |
| `/accounts/new` | `AccountEdit` | Create new account |
| `/accounts/:id` | `AccountDetail` | View account details |
| `/accounts/:id/edit` | `AccountEdit` | Edit existing account |
| `/settings` | `Settings` | Application settings (security, UI, data, autofill) |
| `/autofill-test` | `AutofillTestLogin` | Test page for autofill functionality |
| `/templates` | `TemplateList` | Manage templates |
| `/templates/new` | `TemplateEdit` | Create new template |
| `/templates/:id/edit` | `TemplateEdit` | Edit existing template |

## Providers and Global State

The application uses Zustand for state management with four separate stores:
- **sessionStore**: UI state, active file, auth status
- **accountStore**: Account data and operations
- **templateStore**: Template data and operations
- **settingsStore**: User preferences and configuration

Stores are initialized in `App.tsx` using initializer functions that load persisted data from IndexedDB.

## Android Integration

### Back Button Handling
- **Hook**: `/src/hooks/useAndroidBackButton.ts`
- **Purpose**: Override Android hardware back button behavior
- **Behavior**:
  - In auth page: Exit app if not in submenu
  - In other pages: Navigate back if possible, else prompt to exit
  - Prevents accidental data loss

### Capacitor Plugin Integration
- Plugins are imported and used throughout the application:
  - `KiyoAutofill`: Check/enable autofill service
  - `SecureKey`: Manage biometric-bound vault encryption key
  - `KiyoFile`: Handle file save/open operations

## Initialization Sequence

1. **Bootstrap** (`main.tsx`):
   - Create React root
   - Render `<App />` in strict mode

2. **App Initialization** (`App.tsx`):
   - Set up routing providers
   - Initialize Android back button handler
   - Load data from all Zustand stores
   - Apply theme, font size, and auto-lock settings from settings
   - Render route-specific content

3. **Store Initialization** (in each store):
   - Load persisted data from IndexedDB tables
   - Set up persistence listeners
   - Initialize default state if no data exists

## Source

- Files: `/src/main.tsx`, `/src/App.tsx`
- Routing: `react-router-dom` v6
- State Management: Zustand
- Android Integration: Capacitor plugins + custom hooks