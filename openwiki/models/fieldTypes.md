---
type: model
title: Field Types Model
description: FieldType union used by AccountField and TemplateField.
tags: [model, field-types, data-structure]
---
# Field Types
FieldType is the union type used by both AccountField and TemplateField.
Source File: /src/models/fieldTypes.ts
FieldType Definition:
export type FieldType =
  | "text"
  | "email"
  | "password"
  | "url"
  | "tel"
  | "number"
  | "date"
  | "textarea";
UI Mapping
- text → Input type="text"
- email → Input type="email"
- password → PasswordField (with eye toggle)
- url → Input type="url"
- tel → Input type="tel"
- number → Input type="number"
- date → Input type="date" (native picker)
- textarea → Input type="textarea"
Source Anchors
fieldTypes.ts: /src/models/fieldTypes.ts
Inputs: /src/components/inputs/Input.tsx
PasswordField: /src/components/PasswordField.tsx