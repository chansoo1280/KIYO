---
type: model
title: WebsitePreset Model
description: Defines presets for automatic matching of accounts to websites/apps based on domain or package name.
tags: [model, website-preset, data-structure, autofill]
---
# WebsitePreset Model
A WebsitePreset describes a known site/app (Google, GitHub, Naver, Kakao, ...) and provides the icon/domain mapping used by the WebsiteSelector and by Android autofill drawable resolution.
Source File: /src/models/websitePreset.ts
TypeScript Interface:
export interface WebsitePreset {
  id: string;        // e.g., "google", "github"
  domain: string;    // e.g., "google.com"
  label: string;     // e.g., "Google"
  category: string;  // e.g., "search", "social", "finance"
  icon: string;      // Emoji
  drawable?: string;  // Optional drawable resource name (Android-side)
}
Data Source
The actual list of presets lives in /src/data/websitePresets.ts (the canonical home for query helpers). This file (websitePreset.ts) only contains the type.
Query Helpers (in data/websitePresets.ts)
export function searchPresets(query: string): WebsitePreset[]
export function getPresetsByCategory(category: string): WebsitePreset[]
Relationships
- Used by /src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx to populate the preset picker when creating an account.
- Used by Account.icon / Account.domain initialization.
Source Anchors
models/websitePreset.ts: /src/models/websitePreset.ts
data/websitePresets.ts: /src/data/websitePresets.ts
UI: /src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx
Native drawable resolution: /android/app/src/main/java/com/kiyo/app/autofill/icon/IconResourceMapper.kt