---
type: overview
title: Components Overview
description: Shared React UI components — Button, PageHeader, BottomTabs, dialogs, inputs, feedback, icons.
tags: [components, overview, react, ui]
---
# Components Overview
Top-level component inventory.
Layout / Globals
- PageHeader - sticky page header with back/title/right slot.
- PageShell - top-level shell (PageHeader + content + BottomTabs).
- BottomTabs - bottom navigation (Accounts, Templates, Settings).
- AutoLockIndicator - countdown ring when auto-lock is approaching.
- SyncErrorBanner - top banner shown when sessionStore.lastSyncError is set.
- SplashScreen - first-paint loading screen.
Inputs
- Button - rounded button with primary/secondary/danger variants.
- Input - type-aware text input (text, email, url, tel, number, date, textarea).
- PasswordField - eye toggle + obscured password input.
- Checkbox - checkbox with label.
- PinStrengthMeter - zxcvbn-backed strength meter.
Dialogs
- See dialogs/index.md (BaseDialog, ConfirmDialog, FormDialog, FileCreateDialog, FileOpenDialog).
Feedback
- Spinner - loading spinner.
- ErrorMessage - error text with icon.
- ErrorScreen - full-page error fallback.
Icons
- icons.tsx - Lucide SVG React components (Eye, EyeOff, Zap).
- PresetIcon - renders an emoji icon or a default fallback.
Misc
- FieldCard - list-row card for an account field.
- SettingsRow - row for the Settings page.
- SettingsSection - section header + list container.
Source Anchors
- /src/components/