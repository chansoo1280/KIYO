---
type: data-model
title: Website Presets
description: WebsitePreset type plus the websitePresets data and query helpers (searchPresets, getPresetsByCategory) used by the WebsiteSelector.
tags: [data-model, website-presets, icon, domain]
---

# Website Presets

Two files split this concern:

- `/src/models/websitePreset.ts` — the `WebsitePreset` type definition.
- `/src/data/websitePresets.ts` — the dataset (`websitePresets: WebsitePreset[]`) plus query helpers `searchPresets(query)` and `getPresetsByCategory(category)`.

## WebsitePreset Type

```typescript
export interface WebsitePreset {
  id: string;        // e.g., "google", "github"
  domain: string;    // e.g., "google.com"
  label: string;     // e.g., "Google"
  category: string;  // e.g., "social", "work", "finance"
  icon: string;      // Emoji (e.g., "🔍")
  drawable?: string; // Optional Android drawable resource name for native-side icon resolution
}
```

## Dataset

The dataset includes ~15 popular sites (Google, Apple, GitHub, Naver, Kakao, Dropbox, Facebook, Instagram, Netflix, Discord, Steam, Amazon, X/Twitter, etc.) each with `domain`, `label`, `category`, `icon`, and an optional `drawable` for native-side rendering.

## Query Helpers

```typescript
export function searchPresets(query: string): WebsitePreset[]
// Returns presets whose label or domain matches query (case-insensitive).

export function getPresetsByCategory(category: string): WebsitePreset[]
// Filters by category.
```

## Consumer

`/src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx` uses these helpers to populate the preset picker when creating a new account. The user can also type a custom domain.

## Source Anchors

- `websitePreset.ts` — `/src/models/websitePreset.ts`
- `websitePresets.ts` — `/src/data/websitePresets.ts`
- UI — `/src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx`