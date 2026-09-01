---
type: data-model
title: Template Model
description: Template and TemplateField shapes plus DEFAULT_TEMPLATE_FIELDS baseline.
tags: [data-model, template, fields, builtin]
---

# Template Model

`/src/models/template.ts` defines the template shape used to scaffold account creation.

## Template

```typescript
export interface Template {
  id: number;
  name: string;            // e.g., "Login"
  description?: string;
  icon?: string;           // Emoji (e.g., "🔐")
  sortOrder: number;
  fields: TemplateField[]; // Schema the TemplateEditor exposes
  builtin?: boolean;       // true for BUILTIN_TEMPLATES (cannot delete)
  createdAt: number;
  updatedAt: number;
}
```

## TemplateField

```typescript
export interface TemplateField {
  id: string;
  type: FieldType;        // text | email | password | url | tel | number | date
  label: string;          // Default label for AccountField.label
  required?: boolean;
  sensitive?: boolean;    // Hint for masking (e.g., password fields)
  placeholder?: string;
}
```

## DEFAULT_TEMPLATE_FIELDS

```typescript
export const DEFAULT_TEMPLATE_FIELDS: TemplateField[] = [
  { id: "username", type: "text",     label: "Username",  required: true },
  { id: "password", type: "password", label: "Password",  required: true, sensitive: true },
  { id: "email",    type: "email",    label: "Email",     required: false },
  { id: "url",      type: "url",      label: "Website",   required: false },
  { id: "notes",    type: "text",     label: "Notes",     required: false, sensitive: true },
];
```

Used as the seed when the user creates a new template via the `TemplateEdit` page.

## Built-in vs Custom

`BUILTIN_TEMPLATES` (`/src/data/builtinTemplates.ts`) ships a set of starter templates (Login, WiFi, Credit Card). Custom templates are stored in the `db.templates` table; built-in templates are seeded into new vaults by `fileStorage.createDataFile` and are read-only (cannot be deleted).

## Source Anchors

- `template.ts` — `/src/models/template.ts`
- Built-in templates — `/src/data/builtinTemplates.ts`
- Editor — `/src/pages/Templates/TemplateEdit/`