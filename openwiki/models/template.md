---
type: model
title: Template Model
description: Defines a reusable field set used to scaffold new accounts.
tags: [model, template, data-structure, field-template]
---
# Template Model
A Template is a named, ordered list of fields plus an emoji icon. When the user creates a new account, they pick a Template and the AccountFields are seeded with empty values.
Source File: /src/models/template.ts
TypeScript Interface:
export interface Template {
  id: number; // Dexie PK (auto-increment)
  name: string; // Display name (e.g., "Login", "Credit Card")
  description?: string;
  icon: string; // Emoji (e.g., "🔐")
  sortOrder: number; // Display order in picker
  fields: TemplateField[]; // Field definitions
  createdAt: number;
  updatedAt: number;
}
export interface TemplateField {
  id: string; // Stable id within the template (e.g., "username", "password", "cardNumber")
  label: string; // Display label
  type: FieldType; // "text" | "email" | "password" | "url" | "tel" | "number" | "date" | "textarea"
  required?: boolean;
  sensitive?: boolean; // Treat as password (obscured)
  placeholder?: string;
  defaultValue?: string;
}
DEFAULT_TEMPLATE_FIELDS
A constant exported from src/models/template.ts that names the conventional fields ("username", "password", "email", "url", "notes") used by built-in templates and the UI.
Usage Across Layers
- TemplateList page lists all custom templates (plus built-in templates loaded from /src/data/builtinTemplates.ts).
- TemplateEdit page lets the user create/edit templates (fields, icon, sort order).
- AccountEdit uses the selected template to seed account.fields when creating a new account.
Source Anchors
models/template.ts: /src/models/template.ts
Built-in templates: /src/data/builtinTemplates.ts
Icon picker: /src/pages/Templates/TemplateEdit/components/IconPicker.tsx