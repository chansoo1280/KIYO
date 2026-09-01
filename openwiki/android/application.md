---
type: android-component
title: Android Application
description: KiyoApplication, MainActivity, manifest components, and XML resources.
tags: [android, application, manifest, fileprovider]
---

# Android Application Entry

The Android module hosts the React/Capacitor WebView plus the autofill service and secure-key subsystems. This page describes the bootstrap, manifest, and resource configuration.

## KiyoApplication

`/android/app/src/main/java/com/kiyo/app/KiyoApplication.kt`

```kotlin
class KiyoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        try {
            System.loadLibrary("sqlcipher")
            Log.d("KiyoApplication", "SQLCipher loaded successfully")
        } catch (e: UnsatisfiedLinkError) {
            Log.e("KiyoApplication", "SQLCipher load failed", e)
        }
    }
}
```

The application class does only one thing: load the native SQLCipher library at process start. This must happen before any `SQLiteDatabase.openOrCreateDatabase(...)` call in the autofill repositories. Failures are logged but not fatal because the autofill service runs in a separate process context (`<service>` declarations use the application context, but `AutofillRepository` is only instantiated inside `KiyoAutofillService.onFillRequest` / `onSaveRequest`, so a missing library only impacts autofill functionality).

## MainActivity

`/android/app/src/main/java/com/kiyo/app/MainActivity.java`

The `MainActivity` extends `BridgeActivity` (Capacitor's base) and hosts the WebView containing the React app. Its manifest entry:

```xml
<activity
    android:name=".MainActivity"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
    android:theme="@style/AppTheme.NoActionBarLaunch"
    android:launchMode="singleTask"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
</activity>
```

`launchMode="singleTask"` ensures a single instance for biometric flow handoffs (the `KiyoAutofillService.openKiyoApp()` launches this activity to trigger React-side auth).

## Manifest Components

### Activities

| Activity | Purpose | Theme | Exported |
|----------|---------|-------|----------|
| `MainActivity` | WebView host | `AppTheme.NoActionBarLaunch` | true |
| `autofill.AutofillSettingsActivity` | System autofill settings deep-link (currently a stub awaiting implementation) | (default) | true |
| `autofill.KiyoBiometricActivity` | Legacy/separate broadcast-based biometric prompt (not used by current vault-unlock path) | `AppTheme.NoActionBar` | false |
| `autofill.auth.AutofillAuthActivity` | DEVICE_CREDENTIAL/PIN prompt after Keystore `UserNotAuthenticatedException` in `KiyoAutofillService.onFillRequest` | `Theme.Kiyo.AutofillAuth` | false |

### FileProvider

```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

The FileProvider supports URIs shared with other apps (used by `KiyoFilePlugin` for SAF write-back and share-intent flows). The `res/xml/file_paths.xml` resource defines the allowed path roots.

### Autofill Service

```xml
<service
    android:name=".autofill.service.KiyoAutofillService"
    android:label="@string/autofill_service_description"
    android:permission="android.permission.BIND_AUTOFILL_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.service.autofill.AutofillService" />
    </intent-filter>
    <meta-data
        android:name="android.autofill"
        android:resource="@xml/autofill_service" />
</service>
```

The `BIND_AUTOFILL_SERVICE` permission is a system-protected signature permission — only the system Autofill Framework can bind to this service. The `autofill_service.xml` resource declares `settingsActivity="com.kiyo.app.autofill.AutofillSettingsActivity"` (the stub activity above) and the resolvable package name.

### Permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

KIYO is offline-first; the only network permission is `INTERNET` (inherited from Capacitor's default manifest). No `ACCESS_NETWORK_STATE`, no autofill-specific permissions (those are granted via the system autofill UI).

## XML Resources

| Resource | Purpose |
|----------|---------|
| `res/xml/autofill_service.xml` | Autofill Framework metadata (`settingsActivity`, resolvable package). Points at `AutofillSettingsActivity`. |
| `res/xml/file_paths.xml` | FileProvider paths (used by SAF `KiyoFilePlugin`). |
| `res/xml/config.xml` | Capacitor plugin configuration (typically auto-generated; consult Capacitor docs for fields). |

## Lifecycle Notes

- **Single-process**: all native code runs in the main app process. The autofill service shares the process.
- **SQLCipher load**: `KiyoApplication.onCreate` must succeed for autofill DB operations. Failures degrade autofill functionality; PIN unlock via React remains operational (uses Web Crypto API in the WebView, not SQLCipher).
- **No persistent state in process**: `KiyoAutofillService.onCreate` is intentionally empty (per-request fresh repository pattern). No singleton state lives in the service; all caches are constructed on demand.

## Source Anchors

- `KiyoApplication.kt` — `/android/app/src/main/java/com/kiyo/app/KiyoApplication.kt`
- `MainActivity.java` — `/android/app/src/main/java/com/kiyo/app/MainActivity.java`
- `AndroidManifest.xml` — `/android/app/src/main/AndroidManifest.xml`
- Autofill service config — `/android/app/src/main/res/xml/autofill_service.xml`
- File paths — `/android/app/src/main/res/xml/file_paths.xml`
- Capacitor config — `/android/app/src/main/res/xml/config.xml`