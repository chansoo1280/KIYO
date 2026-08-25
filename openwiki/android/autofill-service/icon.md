---
type: component
title: Autofill Icon Handling
description: Icon fetching, caching, and usage in autofill suggestions for the KIYO autofill service.
tags: [android, autofill, icon, resources]
---
# Autofill Icon Handling

The KIYO autofill service displays icons alongside account suggestions to help users quickly identify the correct credential. Icons are sourced from website presets (for known domains) or fall back to a default icon.

## Overview

Icon handling is implemented in the `IconResourceMapper` singleton, which maps domains and package names to Android resource IDs for site-specific icons. The mapping prioritizes:
1. Account custom icons (not yet implemented)
2. Website preset icons based on domain/package matching
3. Default icon

## Implementation

### IconResourceMapper

Located at: `/android/app/src/main/java/com/kiyo/app/autofill/icon/IconResourceMapper.kt`

Key functions:
- `getSiteIconResource(account: AutofillAccount): Int` - Returns the appropriate icon resource for an autofill account
- `getIconResourceForDomain(domain: String): Int` - Convenience method for domain-only lookup

### Website Preset Icons

The mapper includes a hardcoded map of popular websites to their respective icon resources:
- Google, Microsoft, Apple, Naver, Kakao, GitHub, Facebook, Twitter/X, Instagram, Amazon, Netflix, Discord, Dropbox, Steam
- Each entry maps domain variants (e.g., `google.com` and `accounts.google.com`) to the same icon resource

### Icon Resources

Icons are stored as vector drawables in `/android/app/src/main/res/drawable/`:
- `ic_google.xml`, `ic_microsoft.xml`, etc.
- `ic_default_site.xml` serves as the fallback for unknown domains

## Usage in Autofill Service

Icons are used when constructing autofill suggestion datasets:

1. In `AuthRequestHandler.kt` (or similar), when building `FillResponse`:
   - For each matched account, the icon resource ID is obtained via `IconResourceMapper.getSiteIconResource(account)`
   - The icon is set on the `Dataset` using `setIcon(Icon.createWithResource(context, iconRes))`

2. The icon appears alongside the account name and username in the autofill suggestion UI.

## Data Flow

```
Autofill Service (KiyoAutofillService)
        ↓ (onFillRequest)
AutofillRepository (query accounts)
        ↓ (for each account)
IconResourceMapper.getSiteIconResource(account)
        ↓ (returns resource ID)
Dataset.Builder.setIcon(Icon.createWithResource(context, resId))
        ↓
FillResponse with icon-enabled datasets
        ↓
Android Autofill Framework displays icons in suggestions
```

## Testing

Icon mapping logic is tested in:
- `/android/app/src/androidTest/java/com/kiyo/app/autofill/icon/IconResourceMapperTest.kt` (if exists)
- Alternatively, tested indirectly via E2E autofill tests that verify suggestion appearance

## Source

- File: `/android/app/src/main/java/com/kiyo/app/autofill/icon/IconResourceMapper.kt`
- Resources: `/android/app/src/main/res/drawable/ic_*.xml`