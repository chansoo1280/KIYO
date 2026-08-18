---
type: model
title: WebsitePreset Model
description: Defines presets for automatic matching of accounts to websites/apps based on domain or package name.
tags: [model, websitepreset, data-structure]
---

# WebsitePreset Model

The WebsitePreset model defines presets for automatic matching of accounts to websites or apps based on domain or package name. These presets are used by the autofill service to suggest the correct account when a user encounters a login field.

## Source File
- `/src/models/websitePreset.ts`

## TypeScript Interface

```typescript
export interface WebsitePreset {
  id: string;
  name: string;
  domains: string[]; // Array of domain patterns (e.g., ["google.com", "gmail.com"])
  packageNames: string[]; // Array of Android package name patterns (e.g., ["com.google.android.gm"])
  usernameField?: string; // Optional: field ID in the template that contains the username/email
}
```

## Properties Explained

| Property | Type | Description |
|---------|------|-------------|
| `id` | string | Unique identifier for the preset (UUID) |
| `name` | string | Human-readable name of the preset (e.g., "Google", "Facebook") |
| `domains` | string[] | Array of domain strings or patterns that this preset matches for web autofill |
| `packageNames` | string[] | Array of Android package name strings or patterns that this preset matches for app autofill |
| `usernameField` | string (optional) | The field ID in the account's template that should be used as the username for autofill (if not specified, the `username` field of the account is used) |

### Notes on Patterns
- The `domains` and `packageNames` arrays can contain exact matches or patterns.
- For domains, a pattern like `*.google.com` would match `mail.google.com`, `docs.google.com`, etc.
- For package names, a pattern like `com.google.android.*` would match any Google app.

## Usage Across Layers

### Frontend Components
- **Settings Page**: May allow users to manage or view website presets (though currently presets are built-in).
- **Account Creation/Editing**: When saving an account, the autofill service may use the presets to suggest a match for future autofill.

### Zustand Stores
- No dedicated store for website presets; they are imported as static data from `/src/data/websitePresets.ts`.

### Data Layer
- **websitePresets** (`/src/data/websitePresets.ts`): Exports an array of `WebsitePreset` objects as built-in data.
- These presets are used by the Android autofill service to match accounts to apps/websites.

### Android Autofill Service
- The autofill service (`/android/app/src/main/java/com/kiyo/app/autofill/`) uses the website presets to determine which accounts to suggest when autofill is triggered.
- Matching logic:
  - For web: compares the URL's domain against the `domains` array of each preset.
  - For apps: compares the app's package name against the `packageNames` array of each preset.
  - If a match is found, the service returns the account(s) associated with that preset (or all accounts if no preset-specific filtering is done).

## Validation Rules

### WebsitePreset Validation
- `id`: Must be non-empty string (UUID)
- `name`: Must be non-empty string (max 100 chars)
- `domains`: Must be an array of strings (can be empty)
- `packageNames`: Must be an array of strings (can be empty)
- `usernameField`: If present, must be a non-empty string that matches a field ID in the account's template

### Example Validation Errors
- Empty name
- Invalid domain format (though not strictly validated, should be a valid domain pattern)
- Invalid package name format (should be a valid Android package name pattern)
- `usernameField` that does not correspond to any field in common templates (this is a logical validation, not enforced by the model itself)

## Relationships

### Account Relationship
- An Account may be associated with a WebsitePreset if its domain or package name matches the preset's patterns.
- The association is not stored in the Account model; it is computed at runtime by the autofill service.
- When saving an account, the frontend may note which preset matches for debugging or UI purposes, but it is not required.

### Template Relationship
- The optional `usernameField` property refers to a field in the account's template.
- If specified, the autofill service will use the value of that field as the username for autofill suggestions.
- If not specified, the service falls back to the standard `username` field of the account.

## Built-in Website Presets

Built-in presets are defined in `/src/data/websitePresets.ts` and include entries for popular services like:
- Google (domains: ["google.com", "gmail.com"], packageNames: ["com.google.android.gm"])
- Facebook (domains: ["facebook.com"], packageNames: ["com.facebook.katana"])
- Twitter (domains: ["twitter.com"], packageNames: ["com.twitter.android"])
- GitHub (domains: ["github.com"], packageNames: ["com.github.android"])
- And many others for banks, shopping sites, etc.

## Example WebsitePreset

### Google Preset
```json
{
  "id": "google-preset",
  "name": "Google",
  "domains": ["google.com", "gmail.com", "googlemail.com"],
  "packageNames": ["com.google.android.gm"],
  "usernameField": "username"
}
```

### Facebook Preset
```json
{
  "id": "facebook-preset",
  "name": "Facebook",
  "domains": ["facebook.com", "fb.com"],
  "packageNames": ["com.facebook.katana", "com.facebook.lite"],
  "usernameField": "username"
}
```

## Security Considerations

- Website presets contain no sensitive data; they are purely for matching purposes.
- The data is stored in plaintext in the frontend bundle (in `/src/data/websitePresets.ts`).
- No encryption is applied to website preset data.
- The autofill service uses the presets locally on the device; no data is sent to a server for matching.

## Matching Process in Autofill Service

1. When autofill is triggered, the service receives the context (URL for web, package name for app).
2. It iterates through the built-in website presets.
3. For each preset, it checks:
   - If web context: does the URL's domain match any string in the preset's `domains` array?
   - If app context: does the package name match any string in the preset's `packageNames` array?
4. On first match, it uses that preset to determine which accounts to return.
   - It may return all accounts that match the preset (if the preset is used as a filter) or use the preset to prioritize accounts.
   - The exact logic is implemented in the autofill service's repository layer.
5. If no preset matches, it may return all accounts or use a fallback mechanism.

---