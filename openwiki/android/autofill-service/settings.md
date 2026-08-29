---
type: component
title: Autofill Settings Activity
description: Android activity for enabling/disabling the autofill service and configuring related settings.
tags: [android, autofill, settings, activity]
---
# Autofill Settings Activity (`AutofillSettingsActivity.kt`)

The `AutofillSettingsActivity` is a simple Android activity that allows users to enable or disable the KIYO autofill service and configure autofill-related settings. It serves as the entry point for users to interact with the autofill service configuration.

## Purpose

This activity provides a UI for users to:
- Enable or disable the KIYO autofill service
- Access autofill-specific settings (though currently minimal)
- Understand the status of the autofill service

## Implementation

The activity is defined in `/android/app/src/main/java/com/kiyo/app/autofill/settings/AutofillSettingsActivity.kt`:

```kotlin
package com.kiyo.app.autofill.settings

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class AutofillSettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // TODO: Implement settings UI
    }
}
```

## Manifest Registration

The activity is declared in `AndroidManifest.xml`:

```xml
<activity android:name=".autofill.settings.AutofillSettingsActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.settings.AUTOFILL_SETTINGS" />
    </intent-filter>
</activity>
```

This registration allows the activity to be launched when users navigate to:
**System Settings → Apps → KIYO → Autofill**  
or when the system triggers autofill settings.

## Functionality

Currently, the activity is a placeholder with no UI implementation. However, it serves as the hook for the Android autofill settings system. When users access autofill settings for KIYO, this activity is launched.

## Integration Points

### Android System
- Launched via `ACTION_AUTOFILL_SETTINGS` intent
- Part of the Android autofill service lifecycle

### KIYO Application
- No direct integration with frontend or other Android components
- Relies on system-level autofill enable/disable

## Future Enhancements

Planned functionality for this activity includes:
- Toggle to enable/disable KIYO autofill service
- Display current autofill service status
- Links to vault management or authentication
- Explanation of autofill permissions and usage

## Related Components

- **Autofill Service**: `/openwiki/android/autofill-service/service-overview.md`
- **Capacitor Plugin Bridge**: `/openwiki/android/capacitor-plugins/kiyautofill-plugin.md`
- **Frontend Usage**: `/openwiki/frontend/pages/settings.md` (Autofill section)

## Testing

This activity is primarily tested through manual verification on Android devices. E2E tests may cover launching the activity via intent.

## Source

- File: `/android/app/src/main/java/com/kiyo/app/autofill/settings/AutofillSettingsActivity.kt`
- Manifest: `/android/app/src/main/AndroidManifest.xml`