---
type: data
title: Built-in Templates
description: BUILTIN_TEMPLATES seed dataset — Login, Credit Card, Identity, Wi-Fi.
tags: [data, templates, builtin, seed]
---
# Built-in Templates
Source File: /src/data/builtinTemplates.ts
Dataset
```typescript
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: -1,
    name: "Login",
    description: "Standard website login (username + password + URL)",
    icon: "🔐",
    sortOrder: 1,
    fields: [
      { id: "username", label: "Username", type: "text", required: true },
      { id: "password", label: "Password", type: "password", required: true, sensitive: true },
      { id: "url", label: "URL", type: "url" },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  { id: -2, name: "Credit Card", icon: "💳", sortOrder: 2, fields: [...] },
  { id: -3, name: "Identity", icon: "👤", sortOrder: 3, fields: [...] },
  { id: -4, name: "Wi-Fi", icon: "📶", sortOrder: 4, fields: [...] },
];
```
The id: -1 placeholders are reassigned on insertion.
Behavior
- Built-in templates are immutable (templateStore.deleteTemplate refuses to delete built-in templates).
- The "Duplicate" action on the TemplateList page copies a built-in template into a custom template that the user can edit.
Consumer
- TemplateList page renders BUILTIN_TEMPLATES alongside custom templates from templateStore.
- fileStorage.createDataFile seeds BUILTIN_TEMPLATES into a new vault's templates array.
Source Anchors
- /src/data/builtinTemplates.ts
- /src/database/fileStorage.ts (createDataFile)