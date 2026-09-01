---
type: data
title: Icons
description: ICON_OPTIONS emoji registry used by the template IconPicker. Distinct from components/icons.tsx (Lucide SVGs).
tags: [data, icons, emoji, picker]
---
# Icons
Source File: /src/data/icons.ts
Dataset
```typescript
export const ICON_OPTIONS: string[] = [
  "🔐", "🔑", "👤", "🛡️", "📧",
  "🌐", "📱", "💼", "🏦", "💳",
  "🎮", "📷", "🎵", "📚", "✈️",
  "🛒", "🍔", "☕", "🏠", "🚗",
];
```
20 starter emojis for typical account categories.
Consumer
- /src/pages/Templates/TemplateEdit/components/IconPicker.tsx renders ICON_OPTIONS as a clickable grid; the selected emoji is stored on Template.icon / Account.icon.
Distinguishing from Components Icons
- /src/data/icons.ts is the emoji registry (string[]).
- /src/components/icons.tsx exports Lucide SVG React components (Eye, EyeOff, Zap) used by view components.
Source Anchors
- /src/data/icons.ts
- /src/pages/Templates/TemplateEdit/components/IconPicker.tsx
- /src/components/icons.tsx (Lucide SVGs)