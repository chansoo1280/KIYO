---
type: data-model
title: Website Presets
description: Website preset data for domain matching and autofill suggestions.
tags: [data-model, website, autofill, presets]
---
# Website Presets

Website presets are predefined configurations for popular websites that enable quick account creation and improve autofill matching accuracy. They contain information about the website's domain, login URL, category, and search aliases.

## Purpose

Website presets serve two main functions:
1. **Autofill Matching Improvement**: Provide accurate domain information for matching saved credentials to login forms
2. **User Experience Enhancement**: Offer quick account creation with pre-filled information for popular sites

## Data Structure

Defined in `/src/models/websitePreset.ts`:

```typescript
export interface WebsitePreset {
  id: string;
  name: string;              // Display name
  aliases: string[];         // Search keywords (Korean/English)
  icon?: string;             // Future icon support
  websiteUrl: string;        // Login URL for autofill
  domain: string;            // Normalized domain for autofill matching
  category?: string;         // Category for grouping (e.g., "email", "social", "shopping")
}
```

## Implementation

The presets are stored in `/src/data/websitePresets.ts` as a typed array:

```typescript
export const websitePresets: WebsitePreset[] = [
  {
    id: "google",
    name: "Google",
    aliases: ["google", "구글", "gmail", "지메일"],
    websiteUrl: "https://accounts.google.com",
    domain: "google.com",
    category: "email",
  },
  // ... other presets
];
```

### Fields Explained

- **id**: Unique identifier for the preset
- **name**: Display name shown in the UI
- **aliases**: Search terms users can type to find this preset (supports Korean and English)
- **websiteUrl**: The login URL that will be pre-filled when creating an account
- **domain**: The normalized domain used for autofill matching (must match what extractDomain() returns)
- **category**: Optional grouping for organizational purposes in the UI

## Usage

### In Account Creation

When users select a website preset during account creation:
1. The preset's `websiteUrl` is used as the initial value for the website field
2. The preset's `domain` is stored with the account for autofill matching
3. The preset's `name` and `aliases` improve discoverability

### In Autofill Service

The Android autofill service uses similar domain matching logic (see `/openwiki/android/autofill-service/domain-matching.md`) to determine if saved credentials match the current app/website.

### In Frontend Components

Website presets are used in:
- `/src/pages/Home.tsx` - For quick account creation buttons
- `/src/pages/Accounts/AccountEdit.tsx` - In the website field autocomplete
- `/src/store/templateStore.ts` - May influence template suggestions

## Related Components

- **Data Model**: `/openwiki/models/websitePreset.md`
- **URL Utilities**: `/openwiki/frontend/utils.md` (extractDomain function used for matching)
- **Autofill Repository**: `/openwiki/android/repository/autofill-repository.md` (DomainMatcher)
- **Built-in Templates**: `/openwiki/data-models/builtin-templates.md`

## Extending Presets

To add a new website preset:
1. Add a new object to the `websitePresets` array in `/src/data/websitePresets.ts`
2. Ensure the `domain` matches what `extractDomain()` would return from the login URL
3. Provide relevant aliases in both English and Korean for better discoverability
4. Optionally add a category for grouping in the UI

## Source

- File: `/src/data/websitePresets.ts`
- Type definition: `/src/models/websitePreset.ts`
- Usage examples: `/src/pages/Home.tsx`, `/src/pages/Accounts/AccountEdit.tsx`