---
type: page
title: RootRedirect
description: Entry-point page that orchestrates preload of stores and redirects to /accounts or /auth based on vault state.
tags: [page, root-redirect, routing, preload]
---
# RootRedirect
Source File: /src/pages/RootRedirect.tsx
Route: /
Responsibility
RootRedirect is the only place that orchestrates the initial preload of stores. App.tsx intentionally avoids calling useEffect that triggers loadAccounts/loadTemplates (see App.simple.test.tsx regression test). Instead, RootRedirect owns the preload coordination.
State Machine
```typescript
type Status = { kind: "checking" | "preloading" | "redirecting" | "error" }
```
- `checking`: First render — pulls sessionStore state (activeFileName, cryptoKey, salt) and decides whether to preload or redirect.
- `preloading`: loadAccounts + loadTemplates are awaited. If either fails the state becomes `error`.
- `redirecting`: Navigate to `/accounts` (cryptoKey present) or `/auth` (no cryptoKey) or `/home` (no activeFileName).
- `error`: SyncErrorBanner shown; user can retry.
Branch Logic
- activeFileName === null → /home (no vault selected yet).
- activeFileName !== null && cryptoKey === null → /auth (need PIN/biometric).
- activeFileName !== null && cryptoKey !== null → preload stores then /auth (PIN/biometric required) or /accounts (already unlocked).
- sessionStore.activeFileName may be stale from a previous session that has since been deleted → RootRedirect detects this and clears session before redirecting to /home.
Stale Detection
RootRedirect uses fileTable.getById(activeFileName) to verify the vault still exists. If not, it calls sessionStore.clearSession() and routes to /home.
Focused Tests
- src/pages/RootRedirect.test.tsx covers all four states (checking, preloading → redirect, error from loadAccounts, stale activeFileName cleanup).
- src/App.simple.test.tsx is the regression test asserting App.tsx does not call useEffect for loadAccounts/loadTemplates (would conflict with RootRedirect).
Source Anchors
- Page: /src/pages/RootRedirect.tsx
- Regression test: /src/App.simple.test.tsx
- useFileAuthGuard: /src/hooks/useFileAuthGuard.ts (pages that self-load)