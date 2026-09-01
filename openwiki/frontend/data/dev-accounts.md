---
type: data
title: Dev Accounts (Seed)
description: devAccounts seed dataset loaded into new vaults so the React UI has demo content.
tags: [data, dev, seed, demo]
---
# Dev Accounts (Seed)
Source File: /src/data/devAccounts.ts
Dataset
```typescript
export const devAccounts: Account[] = [
  { id: -1, title: "Google", username: "[email protected]", password: "demo-password", domain: "google.com", icon: "🔍", tags: ["search", "demo"], favorite: true, fields: [...], createdAt: ..., updatedAt: ... },
  { id: -2, title: "GitHub", ... },
  // ~5 entries total
];
```
The id: -1 placeholders are reassigned by Dexie's auto-increment PK on first bulkPut.
Consumer
- fileStorage.createDataFile injects devAccounts into a new vault's accounts array when the vault has no PIN (plaintext vault path) or for the brand-new vault flow.
Source Anchors
- /src/data/devAccounts.ts
- /src/database/fileStorage.ts (createDataFile)