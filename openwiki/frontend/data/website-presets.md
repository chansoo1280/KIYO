---
type: data
title: Website Presets
description: websitePresets dataset plus searchPresets and getPresetsByCategory helpers used by WebsiteSelector.
tags: [data, presets, website, autofill]
---
# Website Presets
Source File: /src/data/websitePresets.ts
Dataset
The dataset lives in websitePresets.ts (not websitePreset.ts which is only the type definition). ~15 entries:
- Search: Google 🔍
- Productivity: GitHub, Apple, Dropbox, X (Twitter)
- Social: Facebook, Instagram, Discord, KakaoTalk, Naver
- Entertainment: Netflix, Steam
- Shopping: Amazon
Type: see /openwiki/models/websitePreset.md.
Helpers
```typescript
export function searchPresets(query: string): WebsitePreset[]
// Returns presets whose label or domain matches query (case-insensitive substring).

export function getPresetsByCategory(category: string): WebsitePreset[]
// Filters by exact category.
```
Consumer
- /src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx calls these helpers to populate the preset picker when the user creates an account.
Source Anchors
- /src/data/websitePresets.ts
- Type: /src/models/websitePreset.ts
- UI: /src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx