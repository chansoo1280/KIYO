---
type: page
title: Home Page
description: The home page of the KIYO application, displaying account overview and quick actions.
tags: [frontend, page, home]
---

# Home Page

The home page (`/src/pages/Home.tsx`) serves as the main entry point after authentication, providing users with an overview of their accounts and quick access to common actions.

## Responsibilities

- Display a list of accounts with basic information (username, website/app, favicon)
- Provide quick actions: add new account, search accounts, access settings
- Show auto-lock status and remaining time
- Handle account selection for detailed view

## Implementation Details

### Component Structure
The home page is implemented as a functional component using React hooks for state management and side effects.

### Data Fetching
- Uses `useAccountStore` to load and access account data
- Calls `loadAccounts()` on mount to populate the account list from IndexedDB
- Accounts are displayed in a list format with avatars and metadata

### UI Components
- Account list rendered with `AccountListItem` components (not shown in skeleton but referenced)
- Search bar for filtering accounts
- Floating action button for adding new accounts
- Auto-lock indicator from `@/components/AutoLockIndicator`

### Navigation
- Uses React Router DOM for navigation to:
  - Account detail: `/accounts/:id`
  - Account edit: `/accounts/:id/edit` or `/accounts/new`
  - Settings: `/settings`
  - Templates: `/templates`
  - Authentication: `/auth`

## Key Features

### Account Display
Each account in the list shows:
- Website or application favicon
- Account title (usually website/app name)
- Username or email
- Last modified timestamp

### Interactions
- Tap on account: Navigates to account detail view
- Long press: May show context menu for actions (edit, delete, copy)
- Search: Real-time filtering of accounts as user types
- FAB (+): Opens new account creation form

### Auto-lock Integration
- Displays remaining auto-lock time via `AutoLockIndicator`
- Timer resets on user activity (touch events)
- When timer expires, navigates to auth screen requiring PIN/biometric

## Related Components
- `AccountListItem`: Individual account row in the list
- `SearchBar`: Input for filtering accounts
- `AutoLockIndicator`: Shows remaining lock time
- `FloatingActionButton`: Circular button for primary action

## State Management
- Account data managed through Zustand store (`accountStore`)
- UI state (search query, selected account) managed locally with `useState`
- Auto-lock state managed through `sessionStore` and `useAutoLock` hook

## Security Considerations
- No sensitive data (passwords) displayed in list view
- Account titles and usernames are shown, but passwords hidden
- Auto-lock protects data when device is unattended
- All account data decrypted only in memory when needed

## Tests
- Unit tests for component rendering and interactions
- Integration tests for account loading and navigation
- Snapshot tests for UI consistency

---