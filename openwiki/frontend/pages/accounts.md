---
type: page
title: AccountList Page
description: Account index page with search, AND-tag filter, sort, and TemplatePicker-driven create flow.
tags: [page, accounts, list, search, tag-filter]
---
# AccountList Page
Source File: /src/pages/Accounts/index.tsx
Route: /accounts
Responsibility
- Lists accounts in the active vault.
- Filters: text search (across title, username, domain) and AND-tag filter (all selected tags must be present).
- Sort: by title (A→Z / Z→A) or by updatedAt (newest / oldest).
- Empty-state CTA opens TemplatePicker to start a new account.
- Each row links to /accounts/:id (AccountDetail).
AND-Tag Filter Semantics
```typescript
const filtered = accounts.filter((a) =>
  selectedTags.every((tag) => a.tags.includes(tag))
);
```
The `.every` makes the filter conjunctive (AND), not disjunctive.
Self-Load via useFileAuthGuard
```typescript
useFileAuthGuard({
  onInitialized: () => loadAccounts().catch(...),
});
```
This triggers loadAccounts if RootRedirect's preload didn't already run. The store-side `initialized` flag prevents duplicate loads.
TemplatePicker Integration
The "+" button at the bottom of the list opens /src/pages/Accounts/components/TemplatePicker.tsx. On selection, navigates to /accounts/new with the template id as state.
Focused Tests
- src/pages/Accounts/AccountList.test.tsx covers search, tag-AND filter, sort, empty state, TemplatePicker open.
Source Anchors
- Page: /src/pages/Accounts/index.tsx
- TemplatePicker: /src/pages/Accounts/components/TemplatePicker.tsx
- Hook: /src/hooks/useFileAuthGuard.ts