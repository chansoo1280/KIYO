---
type: capacitor-plugin
title: KiyoAutofill Web Contract
description: Web-side TypeScript contract for KiyoAutofill plugin (autofill status, sync, settings).
tags: [capacitor, plugin, autofill, web, bridge]
---
# KiyoAutofill (Web)
Source Files: /src/plugins/kiyautofill.ts (real/native) and /src/plugins/kiyautofill.web.ts (web fallback).
Bridge Path
- Native impl: /android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt
- Registration: capacitor.config.ts via pluginClass (and Capacitor 8 plugin auto-registration)
API Surface
```typescript
export interface KiyoAutofillPlugin {
  isAutofillEnabled(): Promise<{ enabled: boolean; isOurService: boolean }>
  openAutofillSettings(): Promise<void>
  syncAccountsFromReact(options: { accountsJson: string }): Promise<{
    success: boolean
    syncedCount: number
    errorCount: number
  }>
}
```
Web Fallback (kiyautofill.web.ts)
On web builds, all three methods return safe defaults:
- isAutofillEnabled → { enabled: false, isOurService: false }
- openAutofillSettings → resolves immediately
- syncAccountsFromReact → { success: false, syncedCount: 0, errorCount: 0 }
The web fallback also mocks `AutofillManager` for the test environment.
Consumers
- accountStore.syncToAutofill - syncAccountsFromReact after every account mutation.
- Settings/AutofillSection - isAutofillEnabled + openAutofillSettings.
- RootRedirect - isAutofillEnabled to detect platform.
Source Anchors
- Web: /src/plugins/kiyautofill.ts, /src/plugins/kiyautofill.web.ts
- Native: /android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt
- SyncManager: /android/app/src/main/java/com/kiyo/app/capacitor/AutofillSyncManager.kt