---
type: data-model
title: Dev Accounts (Seed Data)
description: devAccounts seed dataset loaded into newly created vaults so the React UI has demo content for screenshots and demos.
tags: [data-model, seed, dev, demo]
---

# Dev Accounts (Seed Data)

`/src/data/devAccounts.ts` exports `devAccounts`, a small dataset of fake accounts used as the initial seed when a new vault is opened for the first time. This is the React counterpart to the Android app's dev/QA data.

## Dataset

```typescript
export const devAccounts: Account[] = [
  {
    id: -1,
    title: "Google",
    username: "[email protected]",
    password: "demo-password",
    websiteUrl: "https://google.com",
    domain: "google.com",
    packageNames: ["com.google.android.googlequicksearchbox"],
    tags: ["search", "demo"],
    favorite: true,
    fields: [...],
    icon: "🔍",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  // ...
];
```

Typically ~5 entries (Google, GitHub, Naver, Kakao, Netflix).

## Lifecycle

- `fileStorage.createDataFile` injects `devAccounts` into the new vault's `accounts` array when no PIN is provided (i.e., for plaintext vaults and brand-new vaults).
- The `id: -1` placeholder is reassigned by Dexie's auto-increment PK on the first `bulkPut`.

## Source Anchors

- `devAccounts.ts` — `/src/data/devAccounts.ts`
- Seeding — `/src/database/fileStorage.ts::createDataFile`