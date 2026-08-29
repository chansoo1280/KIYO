---
type: component
title: Frontend State Management
description: Zustand stores for session, account, template, and settings management with persistence to IndexedDB.
tags: [frontend, state, zustand, store]
---
# Frontend State Management

KIYO uses Zustand for state management with four separate stores that handle different aspects of the application state. Each store is persisted to IndexedDB to maintain state across sessions.

## Overview

The application divides state into four logical stores:
1. **sessionStore**: UI state, active file, authentication status
2. **accountStore**: Account data (CRUD operations, search, filtering)
3. **templateStore**: Template data (CRUD operations, built-in templates)
4. **settingsStore**: User preferences and configuration

Each store implements persistence using custom middleware that saves/loads data to/from IndexedDB via Dexie.js.

## Store Implementation Pattern

All stores follow a similar pattern:
- Define state interface
- Create store with `create()` from Zustand
- Implement persistence middleware
- Export typed hooks for components to use state and actions
- Initialize with default values and load persisted data

### Example Store Structure

```typescript
interface State {
  // state properties
}

const useStore = create<State>()(
  persist(
    (set, get) => ({
      // state initialization
      // actions
    }),
    {
      name: "store-name", // unique storage key
      getStorage: () => dexieStorage, // custom Dexie storage
    }
  )
);

// Typed hooks
export const useStoreState = () => useStore((state) => state);
export const useStoreActions = () => useStore((state) => state.actions);
// ... other selective hooks
```

## Session Store (`sessionStore`)

**File**: `/src/store/sessionStore.ts`

Manages UI state and session-related data:

### State Properties
- `activeFileId`: Currently opened vault file ID (nullable)
- `isAuthenticated`: Whether the vault is unlocked
- `isLockScreenShown`: Whether the lock screen is currently displayed
- `activeTab`: Currently active tab in UI (accounts, templates, etc.)
- `searchQuery`: Current search filter in account list

### Actions
- `setActiveFileId(id)`: Set the currently opened file
- `setAuthenticated(status)`: Update authentication status
- `toggleLockScreen()`: Show/hide lock screen
- `setActiveTab(tab)`: Change active tab
- `setSearchQuery(query)`: Update search filter

### Persistence
- Persists: `activeFileId`, `isAuthenticated`, `activeTab`, `searchQuery`
- Does not persist: `isLockScreenShown` (UI-only state)

## Account Store (`accountStore`)

**File**: `/src/store/accountStore.ts`

Manages account data and operations:

### State Properties
- `accounts`: Array of Account objects
- `isLoading`: Loading state for async operations
- `error`: Error message from failed operations

### Actions
- `loadAccounts()`: Load all accounts from IndexedDB for active file
- `addAccount(account)`: Add new account
- `updateAccount(id, updates)`: Update existing account
- `deleteAccount(id)`: Remove account
- `searchAccounts(query)`: Filter accounts by search term
- `filterAccountsByTag(tag)`: Filter accounts by tag
- `sortAccounts(sortBy, sortOrder)`: Sort accounts by field

### Persistence
- Persists: `accounts` array
- Does not persist: loading/error states (transient)

## Template Store (`templateStore`)

**File**: `/src/store/templateStore.ts`

Manages template data and operations:

### State Properties
- `templates`: Array of Template objects (custom + built-in)
- `isLoading`: Loading state
- `error`: Error message

### Actions
- `loadTemplates()`: Load templates from IndexedDB
- `addTemplate(template)`: Add new template
- `updateTemplate(id, updates)`: Update template
- `deleteTemplate(id)`: Remove template (only custom templates)
- `getBuiltInTemplates()`: Return built-in template definitions
- `getTemplateById(id)`: Find template by ID

### Persistence
- Persists: `templates` array (custom templates only)
- Built-in templates are loaded from `/src/data/builtinTemplates.ts` on each load

## Settings Store (`settingsStore`)

**File**: `/src/store/settingsStore.ts`

Manages user preferences and application configuration:

### State Properties
- `theme`: "light" | "dark" | "system"
- `fontSize`: "small" | "medium" | "large"
- `autoLockTimeout`: "none" | "1m" | "10m" | "30m"
- `biometricUnlockEnabled`: boolean
- `showPasswordsByDefault`: boolean
- `autofillEnabled`: boolean
- `createdAt`: timestamp when settings were first initialized

### Actions
- `initializeTheme()`: Apply theme to document root
- `initializeFontSize()`: Apply font size to document root
- `initializeAutoLockTimeout()`: Set up auto-lock timer
- `updateSettings(partialSettings)`: Update multiple settings at once
- `resetToDefaults()`: Reset all settings to default values

### Persistence
- Persists: all settings properties
- Initialized with default values on first run

## Persistence Mechanism

All stores use a custom Dexie-based persistence middleware:

```typescript
const dexieStorage = {
  getItem: async (name: string) => {
    const db = await getDB();
    const item = await db.persistedState.where({ key: name }).first();
    return item?.value ?? null;
  },
  setItem: async (name: string, value: any) => {
    const db = await getDB();
    await db.persistedState.put({ key: name, value, updatedAt: Date.now() });
  },
  removeItem: async (name: string) => {
    const db = await getDB();
    await db.persistedState.where({ key: name }).delete();
  },
};
```

This middleware:
- Uses the same Dexie instance as the main database (`/src/database/db.ts`)
- Stores each store's state as a separate record in the `persistedState` table
- Includes timestamps for conflict resolution (last write wins)
- Handles serialization/deserialization automatically

## Store Usage in Components

Components access stores through typed hooks:

```typescript
// In a React component
import { useAccountStore } from "@/store/accountStore";

function AccountList() {
  const { accounts, isLoading, error } = useAccountState();
  const { loadAccounts, deleteAccount } = useAccountActions();
  
  // ... component logic
}
```

### Selective Hooks

Each store exports specialized hooks to prevent unnecessary re-renders:

- `use*State()`: Returns entire state object
- `use*Actions()`: Returns actions object
- `use*StateSlice(selector)`: Returns specific state properties
- `use*ActionsSlice(selector)`: Returns specific actions

Example:
```typescript
const searchQuery = useSessionState((state) => state.searchQuery);
const { setSearchQuery } = useSessionActions();
```

## Initialization Flow

Stores are initialized in `/src/App.tsx`:

```typescript
useEffect(() => {
  loadAccounts();
  loadTemplates();
  initializeTheme();
  initializeFontSize();
  initializeAutoLockTimeout();
}, [loadAccounts, loadTemplates, initializeTheme, initializeFontSize, initializeAutoLockTimeout]);
```

This ensures:
1. Data is loaded from persistent storage on app start
2. UI settings are applied immediately
3. Auto-lock timer is configured based on user preferences

## Related Components

- **Database Layer**: `/openwiki/database/dexie-schema.md` (persistedState table)
- **Account Model**: `/openwiki/models/account.md`
- **Template Model**: `/openwiki/models/template.md`
- **Settings Usage**: Throughout components for UI customization
- **Persistence Testing**: `/src/store/**/*.test.ts`

## Source

- Files: `/src/store/sessionStore.ts`, `/src/store/accountStore.ts`, `/src/store/templateStore.ts`, `/src/store/settingsStore.ts`
- Persistence middleware: `/src/store/store.ts` (shared utilities)
- Database connection: `/src/database/db.ts`
- IndexedDB schema: `/src/database/dexie-schema.ts`