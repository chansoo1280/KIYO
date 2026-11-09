---
type: android-component
title: KiyoAutofillPlugin (Native)
description: Capacitor plugin exposing autofill status, syncAccountsFromReact, and openAutofillSettings to the React WebView.
tags: [android, capacitor, autofill, plugin]
---

# KiyoAutofillPlugin

`/android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt` is the native implementation of the `KiyoAutofill` Capacitor plugin (declared at `/src/plugins/kiyautofill.ts`).

## Plugin Shape

```kotlin
@CapacitorPlugin(name = "KiyoAutofill")
class KiyoAutofillPlugin : Plugin() {
    // ...
}
```

## Methods

### isAutofillEnabled

```kotlin
@PluginMethod
fun isAutofillEnabled(call: PluginCall) {
    val bridge = AutofillPlatformBridge.create(context)
    val enabled = bridge.isAutofillServiceEnabled()
    val isOurService = bridge.isCurrentAutofillService()
    call.resolve(JSObject().apply {
        put("enabled", enabled)
        put("isOurService", isOurService)
    })
}
```

Returns the framework-level "any autofill enabled" plus the "is it our service" check. The React side (`accountStore.syncToAutofill`) only proceeds with sync if both are `true`.

### syncAccountsFromReact

```kotlin
@PluginMethod
fun syncAccountsFromReact(call: PluginCall) {
    val accountsJson = call.getString("accountsJson")
    val context = call.activity.applicationContext
    val navigator = activityResultNavigator  // captured at load()
    syncManager.sync(
        context = context,
        accountsJson = accountsJson,
        navigator = navigator,
        onSuccess = { result -> call.resolve(JSObject().apply {
            put("success", result.success)
            put("syncedCount", result.syncedCount)
            put("errorCount", result.errorCount)
            put("securityUpgrade", result.securityUpgrade)
        }) },
        onCancel = { call.reject("Sync cancelled") }
    )
}
```

Delegates the actual work to `AutofillSyncManager.sync`. The `navigator` is captured in `load()` so the activity-result flow can survive plugin instance recreation.

### openAutofillSettings

```kotlin
@PluginMethod
fun openAutofillSettings(call: PluginCall) {
    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).apply {
        putExtra(
            Settings.EXTRA_AUTOFILL_SERVICE_COMPONENT_NAME,
            ComponentName(context, KiyoAutofillService::class.java).flattenToString()
        )
    }
    startActivityForResult.callActivityForResult(...)
}
```

Launches the system autofill settings page so the user can enable KIYO as the autofill provider.

## Lifecycle Hooks

```kotlin
override fun load() {
    super.load()
    activityResultNavigator = SyncAuthNavigator { intentSender ->
        startActivityForResult(
            IntentSenderRequest.Builder(intentSender).build(),
            AUTOFILL_AUTH_REQUEST_CODE
        )
    }
    syncManager = AutofillSyncManager(activityResultNavigator)
}

override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode == AUTOFILL_AUTH_REQUEST_CODE) {
        syncManager.handleAuthResult(resultCode, pendingAuthPayload, onSuccess = ..., onCancel = ...)
    }
}
```

The plugin captures the activity-result launcher at `load()` and routes the result back to the sync manager. This is the standard Capacitor pattern for plugins that need to launch activities for result.

## Pending State

```kotlin
private var pendingAuthPayload: String? = null
```

When the sync throws `UserNotAuthenticatedException`, `KiyoAutofillPlugin` saves the accounts JSON, asks the user to authenticate, and re-issues the sync on `handleOnActivityResult`. The pending payload is cleared after retry.

## Source Anchors

- `KiyoAutofillPlugin.kt` — `/android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt`
- Web stub — `/src/plugins/kiyautofill.ts`, `/src/plugins/kiyautofill.web.ts`
- Sync delegation — `/android/app/src/main/java/com/kiyo/app/capacitor/AutofillSyncManager.kt`
- Bridge — `/android/app/src/main/java/com/kiyo/app/capacitor/AutofillPlatformBridge.kt`

## Tests

- `/android/app/src/test/java/com/kiyo/app/capacitor/KiyoAutofillPluginTest.kt`
- `/android/app/src/test/java/com/kiyo/app/capacitor/AutofillSyncManagerTest.kt`