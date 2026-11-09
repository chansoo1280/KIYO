---
type: data-model
title: Account Model
description: Account and AccountField shapes plus AppSettings and FileMetadata.
tags: [data-model, account, settings, metadata]
---

# Account Model

`/src/models/account.ts` defines the core data model: an `Account` (with flexible `AccountField` list), `AppSettings`, and `FileMetadata`.

## Account

```typescript
export interface Account {
  id: number;
  title: string;          // Display title (e.g., "Personal Gmail")
  username: string;       // Optional username (often the first email/text field)
  password?: string;      // Top-level password (rarely used; usually in fields[])
  websiteUrl?: string;
  domain?: string | null; // Normalized hostname for autofill matching
  packageNames?: string[]; // Android app packages for autofill
  packageName?: string | null;
  appName?: string | null;
  notes?: string;
  tags: string[];         // User-defined tags
  favorite: boolean;
  fields: AccountField[]; // Flexible per-template fields
  icon?: string;          // Emoji
  createdAt: number;
  updatedAt: number;
}
```

## AccountField

```typescript
export interface AccountField {
  id: string;             // Stable field id within account
  type: FieldType;        // See Field Types
  label: string;
  value: string;
  sensitive?: boolean;    // Hint for masking in UI
}
```

## AppSettings

```typescript
export interface AppSettings {
  id?: number;            // Singleton ID = 1
  theme: "light" | "dark" | "system";
  fontSize: "small" | "medium" | "large";
  autoLockTimeout: "none" | "1m" | "10m" | "30m";
  biometricEnabled: boolean;
  autofillEnabled: boolean;
  showPasswordsByDefault: boolean;
  autoBackupEnabled: boolean;
  autoBackupUri?: string | null; // SAF content:// URI
  createdAt: number;
  updatedAt: number;
}
```

## FileMetadata

```typescript
export interface FileMetadata {
  id: number;             // Singleton ID = 1
  version: string;        // Schema version
  createdAt: number;
  updatedAt?: number;
}
```

## Source Anchors

- `account.ts` — `/src/models/account.ts`
- Store — `/src/store/accountStore.ts`, `settingsStore.ts`