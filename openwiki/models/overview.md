---
type: overview
title: Models Overview
description: Overview of TypeScript models defining core data structures in KIYO.
tags: [models, typescript, data-structures]
---

# Models Overview

KIYO uses TypeScript interfaces and types to define the core data structures that represent accounts, templates, vaults, and other domain entities. These models are used throughout the frontend (components, pages, stores), database layer, and Capacitor plugins to ensure type safety and data consistency.

## Core Models

### Account (`src/models/account.ts`)
Represents a single password/account entry with fields for username, password, notes, and custom fields defined by templates.

### FieldTypes (`src/models/fieldTypes.ts`)
Defines the types of fields that can be used in templates and accounts (e.g., text, password, email, URL, OTP).

### Template (`src/models/template.md`)
Represents a field template that defines a set of fields for a particular type of account (e.g., login, credit card, identity).

### Vault (`src/models/vault.md`)
Represents an encrypted container (file) that stores multiple accounts, used for importing/exporting data.

### WebsitePreset (`src/models/websitePreset.md`)
Defines presets for automatic matching of accounts to websites/apps based on domain or package name.

## Usage Across Layers

- **Frontend Components**: Models are used for form state, validation, and rendering UI.
- **Zustand Stores**: Stores operate on model instances for CRUD operations and persistence.
- **Database Layer**: Dexie.js tables are typed according to these models.
- **Capacitor Plugins**: Data passed between web and native layers is structured according to these models.
- **Crypto Utilities**: Encryption/decryption functions expect data structured as per these models.

## Validation and Relationships

- Models include validation rules (e.g., required fields, format constraints).
- Relationships:
  - An Account uses a Template to define its custom fields.
  - A Template consists of FieldTypes.
  - A Vault contains multiple Accounts.
  - WebsitePreset is used to match Accounts to apps/websites for autofill.

## Example: Account Model Structure

```typescript
interface Account {
  id: string;
  name: string; // Account name or title
  username: string;
  password: string;
  notes?: string;
  fields: CustomField[]; // Defined by template
  templateId: string; // Reference to template
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  tags: string[];
}
```

## Example: FieldTypes

```typescript
type FieldType = 
  | 'text'
  | 'password'
  | 'email'
  | 'url'
  | 'otp'
  | 'phone'
  | 'address'
  | 'name'
  | 'company';
```

## Example: Template

```typescript
interface Template {
  id: string;
  name: string;
  fields: FieldDescriptor[]; // Array of { id: string; type: FieldType; label: string; required: boolean }
}
```

## Security Considerations

- Models themselves do not contain sensitive data; they define structure only.
- Sensitive data (like passwords) is encrypted at the storage layer, not in the model definitions.
- Models ensure that encrypted data is handled with the correct structure after decryption.