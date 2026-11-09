---
type: page
title: Templates Pages
description: TemplateList and TemplateEdit pages with sub-components IconPicker and TemplateFieldEditor.
tags: [page, templates, list, edit]
---
# Templates Pages
TemplateList (/src/pages/Templates/index.tsx, route /templates)
- Lists custom templates (templateStore.getAllTemplates()) plus built-in templates from /src/data/builtinTemplates.ts.
- Per-row actions: Edit (navigates to /templates/:id/edit) for custom only, Duplicate (for built-in), Delete (custom only).
- "+" button navigates to /templates/new.
TemplateEdit (/src/pages/Templates/TemplateEdit/index.tsx, route /templates/new and /templates/:id/edit)
- Edits name, description, icon, sortOrder, fields.
- IconPicker (/src/pages/Templates/TemplateEdit/components/IconPicker.tsx) - 20-emoji grid.
- TemplateFieldEditor (/src/pages/Templates/TemplateEdit/components/TemplateFieldEditor.tsx) - add / remove / reorder fields; sets id, label, type, required, sensitive, placeholder, defaultValue.
Self-Load via useFileAuthGuard
```typescript
useFileAuthGuard({
  onInitialized: () => loadTemplates().catch(...),
});
```
Focused Tests
- src/pages/Templates/TemplateEdit/index.test.tsx covers create, edit, field add/remove, icon select.
Source Anchors
- List: /src/pages/Templates/index.tsx
- Edit: /src/pages/Templates/TemplateEdit/index.tsx
- IconPicker: /src/pages/Templates/TemplateEdit/components/IconPicker.tsx
- TemplateFieldEditor: /src/pages/Templates/TemplateEdit/components/TemplateFieldEditor.tsx
- Built-in templates: /src/data/builtinTemplates.ts