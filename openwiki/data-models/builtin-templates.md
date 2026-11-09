---
type: data-model
title: Built-in Templates
description: BUILTIN_TEMPLATES dataset shipped with the app — read-only starter templates (Login, WiFi, Credit Card).
tags: [data-model, templates, builtin, starter]
---

# Built-in Templates

`/src/data/builtinTemplates.ts` exports `BUILTIN_TEMPLATES`, a read-only dataset of starter templates that ship with every newly created vault.

## Dataset

```typescript
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "builtin-login",
    name: "Login",
    description: "Standard website or app login",
    icon: "🔐",
    sortOrder: 0,
    builtin: true,
    fields: [
      { id: "username", type: "text",     label: "Username", required: true },
      { id: "password", type: "password", label: "Password", required: true, sensitive: true },
      { id: "url",      type: "url",      label: "Website URL" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-wifi",
    name: "WiFi",
    icon: "📶",
    sortOrder: 1,
    builtin: true,
    fields: [
      { id: "ssid",     type: "text",     label: "SSID",     required: true },
      { id: "password", type: "password", label: "Password", required: true, sensitive: true },
      { id: "security", type: "text",     label: "Security" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "builtin-credit-card",
    name: "Credit Card",
    icon: "💳",
    sortOrder: 2,
    builtin: true,
    fields: [
      { id: "number",     type: "text",     label: "Card Number",   required: true, sensitive: true },
      { id: "holder",     type: "text",     label: "Cardholder" },
      { id: "expiry",     type: "text",     label: "Expiry" },
      { id: "cvv",        type: "password", label: "CVV",           sensitive: true },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
];
```

## Lifecycle

- `fileStorage.createDataFile` injects `BUILTIN_TEMPLATES` into the new vault's `templates` array.
- The `templateStore` exposes `getBuiltInTemplates()` which returns `BUILTIN_TEMPLATES` (synchronous, no DB lookup).
- Built-in templates cannot be deleted (the `templateStore.deleteTemplate` action guards against `builtin: true`).

## Source Anchors

- `builtinTemplates.ts` — `/src/data/builtinTemplates.ts`
- Seeding — `/src/database/fileStorage.ts::createDataFile`
- Store — `/src/store/templateStore.ts::getBuiltInTemplates`