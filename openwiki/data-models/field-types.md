---
type: data-model
title: Field Types
description: FieldType union used by AccountField and TemplateField; rendered by inputs.
tags: [data-model, field-types, ui]
---

# Field Types

`/src/models/fieldTypes.ts` defines the `FieldType` union used by both `AccountField` and `TemplateField`.

## FieldType

```typescript
export type FieldType =
  | "text"
  | "email"
  | "password"
  | "url"
  | "tel"
  | "number"
  | "date"
  | "textarea";
```

## UI Mapping

The `Input` component (`/src/components/inputs/Input.tsx`) and `PasswordField` (`/src/components/PasswordField.tsx`) switch on `FieldType` to pick:

| FieldType | Component | Behavior |
|-----------|-----------|----------|
| `text` | `Input` (type=text) | Plain text |
| `email` | `Input` (type=email) | Email input with `type="email"` |
| `password` | `PasswordField` | Eye icon to show/hide value |
| `url` | `Input` (type=url) | URL keyboard |
| `tel` | `Input` (type=tel) | Phone keyboard |
| `number` | `Input` (type=number) | Numeric keyboard |
| `date` | `Input` (type=date) | Native date picker |
| `textarea` | `Input` (type=textarea) | Multi-line text |

## Source Anchors

- `fieldTypes.ts` — `/src/models/fieldTypes.ts`
- Inputs — `/src/components/inputs/Input.tsx`
- Password — `/src/components/PasswordField.tsx`