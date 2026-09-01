---
type: data-model
title: Icon Registry
description: Emoji icon registry (ICON_OPTIONS) used by the template IconPicker; distinct from the Lucide SVG icons in components/icons.tsx.
tags: [data-model, icons, emoji, picker]
---

# Icon Registry

`/src/data/icons.ts` exports `ICON_OPTIONS`, a static array of emoji strings that powers the template `IconPicker`. This is distinct from `/src/components/icons.tsx` which exports Lucide SVG components (`Eye`, `EyeOff`, `Zap`, etc.) for the React UI.

## ICON_OPTIONS

```typescript
export const ICON_OPTIONS: string[] = [
  "🔐", "🔑", "👤", "🛡️", "📧",
  "🌐", "📱", "💼", "🏦", "💳",
  "🎮", "📷", "🎵", "📚", "✈️",
  "🛒", "🍔", "☕", "🏠", "🚗",
];
```

20 starter emojis for typical account categories (login, identity, communication, finance, entertainment, etc.).

## Consumer

`/src/pages/Templates/TemplateEdit/components/IconPicker.tsx` renders `ICON_OPTIONS` as a clickable grid. The selected emoji is stored on `Template.icon` and on `Account.icon`.

## Distinguishing from Components Icons

| File | Type | Purpose |
|------|------|---------|
| `/src/data/icons.ts` | `string[]` (emoji) | Template/Account icon selection |
| `/src/components/icons.tsx` | React components (Lucide SVG) | UI affordances (eye, eye-off, zap, etc.) |

## Source Anchors

- `icons.ts` — `/src/data/icons.ts`
- UI — `/src/pages/Templates/TemplateEdit/components/IconPicker.tsx`
- Lucide SVGs — `/src/components/icons.tsx`, `/src/components/PresetIcon.tsx`