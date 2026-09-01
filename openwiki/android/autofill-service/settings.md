---
type: android-component
title: Autofill Settings Activity
description: Stub activity registered as the system autofill settings deep-link target.
tags: [android, autofill, settings, stub]
---

# Autofill Settings Activity (Stub)

`/android/app/src/main/java/com/kiyo/app/autofill/settings/AutofillSettingsActivity.kt` is currently a **stub**. The full source is:

```kotlin
package com.kiyo.app.autofill.settings

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class AutofillSettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Stub: settings UI is intentionally in the React app
    }
}
```

The activity is registered in the manifest and referenced from `autofill_service.xml` as the deep-link target for the system autofill settings entry, but the in-app settings surface lives in the React layer.

## Why the stub exists

`res/xml/autofill_service.xml` declares:

```xml
<autofill-service
    xmlns:android="http://schemas.android.com/apk/res-auto"
    android:settingsActivity="com.kiyo.app.autofill.AutofillSettingsActivity"
    android:packageName="com.kiyo.app" />
```

The Android Autofill Framework requires `settingsActivity` to point to a real `Activity` class. Without it, the system refuses to recognize the service as a valid autofill provider. The stub satisfies this requirement without forcing an in-Kotlin settings UI.

## Where the actual settings live

All user-facing autofill settings (enable/disable the service, sync intervals, etc.) live in the React layer:

- `src/pages/Settings/components/AutofillSection.tsx` — handles `requestAutofillEnable()` via `KiyoAutofillPlugin.requestAutofillEnable()`, surfaces `isAutofillEnabled` status.
- `src/plugins/kiyautofill.web.ts` — web fallback that no-ops gracefully.

## Roadmap

If/when the React settings are insufficient (e.g., adding system-level configuration that requires native UI), this activity can be expanded to host a native settings screen without changing the manifest entry.

## Source Anchors

- `AutofillSettingsActivity.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/settings/AutofillSettingsActivity.kt`
- Manifest entry — `/android/app/src/main/AndroidManifest.xml`
- Autofill service metadata — `/android/app/src/main/res/xml/autofill_service.xml`
- React settings surface — `/src/pages/Settings/components/AutofillSection.tsx`
- Capacitor plugin — `/src/plugins/kiyautofill.ts` and `.web.ts`