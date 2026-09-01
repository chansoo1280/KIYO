---
type: android-component
title: AutofillPlatformBridge
description: Internal contract wrapping AutofillManager and Settings.Secure queries for testing without coupling to system services.
tags: [android, platform-bridge, autofill, di]
---

# AutofillPlatformBridge

`/android/app/src/main/java/com/kiyo/app/capacitor/AutofillPlatformBridge.kt` is the internal abstraction that wraps `AutofillManager` and `Settings.Secure` queries.

## Interface

```kotlin
interface AutofillPlatformBridge {
    fun isAutofillServiceEnabled(): Boolean
    fun isCurrentAutofillService(): Boolean
    fun openAutofillSettings(): Intent
}

object AutofillPlatformBridgeFactory {
    fun create(context: Context): AutofillPlatformBridge
}
```

## Production Implementation

```kotlin
class AndroidAutofillPlatformBridge(private val context: Context) : AutofillPlatformBridge {
    override fun isAutofillServiceEnabled(): Boolean {
        val am = context.getSystemService(AutofillManager::class.java) ?: return false
        return am.hasEnabledAutofillServices()
    }

    override fun isCurrentAutofillService(): Boolean {
        val componentName = ComponentName(context, KiyoAutofillService::class.java)
        val currentService = Settings.Secure.getString(
            context.contentResolver, "autofill_service"
        )
        return currentService != null && currentService == componentName.flattenToString()
    }

    override fun openAutofillSettings(): Intent {
        return Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
            putExtra(
                Settings.EXTRA_AUTOFILL_SERVICE_COMPONENT_NAME,
                ComponentName(context, KiyoAutofillService::class.java).flattenToString()
            )
        }
    }
}
```

## Why an Interface

`KiyoAutofillPluginTest` uses the interface to mock the platform check without booting a real Android system. The Robolectric shadow for `AutofillManager` is incomplete; the interface gives the test a way to substitute the answer.

## Caller

`KiyoAutofillPlugin.isAutofillEnabled` and `KiyoAutofillPlugin.openAutofillSettings` both delegate through `AutofillPlatformBridge.create(context)`.

## Source Anchors

- `AutofillPlatformBridge.kt` — `/android/app/src/main/java/com/kiyo/app/capacitor/AutofillPlatformBridge.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt`