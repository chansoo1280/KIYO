---
type: model
title: Account Model
description: Frontend Account model. Represents a single password/account entry with custom fields defined by templates.
tags: [model, account, data-structure, template]
---
# Account Model
The Account model represents a single password/account entry in KIYO. It includes standard fields (username, password, notes) and custom fields defined by templates, along with metadata for organization and security.
Source File: /src/models/account.ts
TypeScript Interface:
export interface Account {
  id: number; // PK from Dexie (auto-incremented)
  title: string; // Display title (e.g., "Gmail", "Netflix")
  username?: string; // Top-level username field (often duplicated in fields[])
  password?: string; // Top-level password field
  websiteUrl?: string; // Optional website URL for autofill hint
  domain?: string; // Optional normalized domain (e.g., "google.com") for autofill
  packageNames?: string[]; // Optional Android package names (e.g., ["com.google.android.googlequicksearchbox"])
  packageName?: string | null; // Single-package convenience for autofill
  icon?: string; // Emoji icon (optional, defaults in UI)
  notes?: string;
  fields: AccountField[]; // Fields from the template + custom additions
  tags: string[]; // User-defined tags
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  templateId?: number | null; // Reference to the template (null for "no template")
  appName?: string; // Optional display label (e.g., "Google Search")
}
export interface AccountField {
  id: string; // Stable id (often matches TemplateField.id)
  label: string; // Display label
  type: FieldType; // "text" | "email" | "password" | "url" | "tel" | "number" | "date" | "textarea"
  value: string;
  sensitive?: boolean; // Marks the field for password-style obscuring
}
Properties Explained
| Property | Type | Description |
|----------|------|-------------|
| id | number | PK from Dexie (auto-incremented) |
| title | string | Display title (e.g., "Gmail", "Netflix") |
| username | string? | Top-level username |
| password | string? | Top-level password |
| websiteUrl | string? | Login URL (informational) |
| domain | string? | Normalized domain for autofill matching |
| packageNames | string[]? | Android package names for autofill |
| packageName | string? | Single Android package (autofill hint) |
| icon | string? | Emoji icon |
| notes | string? | Free-form notes |
| fields | AccountField[] | Template-derived fields + user-added fields |
| tags | string[] | User-defined tags |
| favorite | boolean | Starred |
| createdAt | number | ms epoch |
| updatedAt | number | ms epoch |
| templateId | number? | PK of the template this account was created from |
| appName | string? | Display label override (used by Android autofill save) |
Usage Across Layers
Frontend Components
AccountList: Displays accounts in a list, showing title, tags, favorite.
AccountDetail: Shows all account fields with copy-to-clipboard.
AccountEdit/Form: Uses template to render appropriate input fields.
Templates: When creating accounts from templates, uses templateId to determine field structure.
Zustand Stores
accountStore: Loads/saves accounts to/from IndexedDB. Handles encryption/decryption of records. Provides CRUD operations (addAccount, updateAccount, deleteAccount, getAccountById). Provides syncToAutofill that pushes accounts to the native autofill.
Database Layer
accountTable (src/database/accountTable.ts): Dexie.js table typed to Account interface. Indexes on createdAt, updatedAt. Encryption handled at table-module layer (createEncryptedRecord/decryptRecord).
Cryptographic Operations
Sensitive fields are encrypted using PBKDF2 key derivation from user PIN, then AES-GCM record-level encryption with random IV (recordEncryption.ts).
Relationships
Template Relationship: Each Account optionally references exactly one Template via templateId. The Template defines the field set the Account has. Custom fields not in the template can also be added.
Vault Relationship: Accounts are bundled inside KiyoVaultData for export/import.
WebsitePreset Relationship: Used for autofill matching via domain.
Autofill Relationship: The account getAutofillAccounts() helper extracts username/password and domain/packageNames for KiyoAutofillPlugin.syncAccountsFromReact.
Source Anchors
models/account.ts: /src/models/account.ts
accountTable.ts: /src/database/accountTable.ts
accountStore.ts: /src/store/accountStore.ts
getAutofillAccounts: /src/store/accountStore.ts::getAutofillAccounts