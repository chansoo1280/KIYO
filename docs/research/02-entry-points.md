# Android Entry Points Analysis - KIYO Password Manager

## Overview
This document analyzes the Android entry points for the KIYO Password Manager app, which is a Capacitor-based hybrid app with native Android Autofill Service integration.

---

## 1. MainActivity

### Role
- **Main Entry Point**: The primary Activity launched when the user taps the app icon
- **Capacitor Bridge**: Extends `BridgeActivity` from Capacitor to host the WebView-based React application
- **Plugin Registration**: Registers the `KiyoAutofillPlugin` for JavaScript-Native communication

### Code Analysis
```java
// android/app/src/main/java/com/kiyo/app/MainActivity.java
public class MainActivity extends BridgeActivity {
    public MainActivity() {
        registerPlugin(KiyoAutofillPlugin.class);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
```

### Call Relationships
1. **App Launch** → `MainActivity.onCreate()` → `BridgeActivity.onCreate()` → Loads Capacitor WebView → Loads React App (`index.html`)
2. **Autofill Service** → `KiyoAutofillService.openKiyoApp()` → `Intent(MainActivity)` with `FLAG_ACTIVITY_NEW_TASK` + extra `"reason": "autofill_auth_required"`
3. **Capacitor Plugin Bridge** → `KiyoAutofillPlugin` methods called from React via `Capacitor.Plugins.KiyoAutofill`

### Initialization Order
1. `Application.onCreate()` (if custom Application class exists - none in this project)
2. `MainActivity.onCreate()` → `super.onCreate()` (BridgeActivity)
3. Capacitor Bridge initialization
4. WebView creation and React app loading
5. `KiyoAutofillPlugin.load()` called → `AutofillRepository` initialized

### Key Characteristics
- **Launch Mode**: `singleTask` (from AndroidManifest)
- **Exported**: `true` (launcher entry point)
- **Theme**: `AppTheme.NoActionBarLaunch` (splash screen theme)
- **Config Changes**: Handles orientation, keyboard, screen size, locale, density, UI mode, navigation changes without recreation

---

## 2. Application Class

### Analysis
**No custom Application class exists** in this project. The app uses the default `android.app.Application`.

### Implications
- No global initialization logic at Application level
- No custom `attachBaseContext()` for multi-dex or split compat
- Autofill Service (`KiyoAutofillService`) runs in its own process context when enabled by user
- `SecuritySession` and `AutofillCrypto` key caches are in-memory only (process lifetime)

### Initialization Order (Default)
1. `Application.onCreate()` (system default)
2. Content Providers initialized (FileProvider)
3. MainActivity launched by launcher
4. Autofill Service started by system when user enables it in Settings

---

## 3. AndroidManifest.xml

### Key Components

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <!-- Main Activity - Launcher Entry Point -->
        <activity
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Autofill Settings Activity -->
        <activity
            android:name=".autofill.AutofillSettingsActivity"
            android:exported="true"
            android:label="@string/autofill_service_description" />

        <!-- Biometric Authentication Activity -->
        <activity
            android:name=".autofill.KiyoBiometricActivity"
            android:exported="false"
            android:label="@string/app_name"
            android:theme="@style/AppTheme.NoActionBar" />

        <!-- FileProvider for sharing files -->
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

        <!-- Autofill Service - System-level Entry Point -->
        <service
            android:name=".autofill.KiyoAutofillService"
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
    </application>
</manifest>
```

### Component Summary

| Component | Type | Exported | Purpose |
|-----------|------|----------|---------|
| MainActivity | Activity | true | App launcher entry |
| AutofillSettingsActivity | Activity | true | Autofill settings UI |
| KiyoBiometricActivity | Activity | false | Biometric auth (internal) |
| FileProvider | Provider | false | File sharing |
| KiyoAutofillService | Service | true | System autofill service |

---

## 4. Service Registration - KiyoAutofillService

### Registration in Manifest
```xml
<service
    android:name=".autofill.KiyoAutofillService"
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

### Key Attributes
- **Permission**: `android.permission.BIND_AUTOFILL_SERVICE` - Only system can bind
- **Exported**: `true` - Required for system to discover and bind
- **Intent Filter**: `android.service.autofill.AutofillService` - Standard autofill service action
- **Meta-data**: References `@xml/autofill_service` for service configuration

### Lifecycle Methods
```kotlin
// KiyoAutofillService.kt
override fun onCreate() {
    super.onCreate()
    repository = AutofillRepository(this)  // Initialize DB
    Log.d(TAG, "AutofillService created")
}

override fun onDestroy() {
    executor.shutdown()
    super.onDestroy()
    Log.d(TAG, "AutofillService destroyed")
}
```

### Call Relationships
1. **System** → Binds to service when user enables autofill in Settings
2. **System** → Calls `onFillRequest()` when app requests autofill
3. **System** → Calls `onSaveRequest()` when user submits form
4. **Service** → `openKiyoApp()` → Starts `MainActivity` with `FLAG_ACTIVITY_NEW_TASK` for biometric auth
5. **Service** → `LocalBroadcastManager` → Receives biometric result from `KiyoBiometricActivity`
6. **Plugin** → `KiyoAutofillPlugin` ↔ `AutofillRepository` (shared SQLite DB)

### Initialization Order
1. User enables "KIYO Autofill" in Settings → System binds service
2. `onCreate()` → `AutofillRepository` initialized → SQLite DB opened
3. `AutofillCrypto` key cache initialized (empty)
4. Service waits for `onFillRequest()` / `onSaveRequest()` callbacks

---

## 5. Activity Lifecycle

### MainActivity (BridgeActivity)
```
onCreate()
  └─ super.onCreate() → Capacitor Bridge init
  └─ WebView created
  └─ Load capacitor-config.json
  └─ Load web assets (index.html)
  └─ React App mounts
  └─ KiyoAutofillPlugin.load() → AutofillRepository init

onStart() → onResume()
  └─ App visible, WebView active

onPause() → onStop()
  └─ App backgrounded

onDestroy()
  └─ WebView destroyed
  └─ Plugin cleanup
```

### AutofillSettingsActivity
```
onCreate()
  └─ Minimal - likely shows settings UI or redirects to system settings
```

### KiyoBiometricActivity
```
onCreate()
  └─ Extract extras (packageName, authReason)
  └─ setupBiometricPrompt() → BiometricPrompt init
  └─ startBiometricAuthentication()

onAuthenticationSucceeded()
  └─ finishWithSuccess() → setResult(OK) + broadcast BIOMETRIC_RESULT

onAuthenticationError()
  └─ finishWithError() → setResult(CANCELED) + broadcast BIOMETRIC_RESULT

onDestroy()
  └─ Cleanup
```

### Lifecycle Interactions

| Scenario | Flow |
|----------|------|
| App Launch | Launcher → MainActivity.onCreate() → React App |
| Autofill Trigger | App requests fill → System → KiyoAutofillService.onFillRequest() |
| Biometric Required | Service → openKiyoApp() → MainActivity (new task) → React handles auth |
| Biometric Auth | Service → KiyoBiometricActivity → BiometricPrompt → Broadcast → Service |
| Save Credentials | User submits form → System → Service.onSaveRequest() → Repository.upsertAccount() |

---

## 6. Intent Filters

### MainActivity - Launcher
```xml
<intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
</intent-filter>
```
- **Action**: `MAIN` - Primary entry point
- **Category**: `LAUNCHER` - Shows in app drawer
- **Result**: App icon tap launches MainActivity

### KiyoAutofillService - System Autofill
```xml
<intent-filter>
    <action android:name="android.service.autofill.AutofillService" />
</intent-filter>
```
- **Action**: `android.service.autofill.AutofillService` - Standard autofill service identifier
- **System Usage**: Settings → Languages & Input → Autofill Service → Lists this service
- **Binding**: System binds with `BIND_AUTOFILL_SERVICE` permission

### KiyoBiometricActivity - Internal
```xml
<!-- No intent-filter - not exported -->
<activity
    android:name=".autofill.KiyoBiometricActivity"
    android:exported="false" />
```
- **Launched by**: `KiyoAutofillService.openKiyoApp()` or `KiyoBiometricActivity.startBiometricAuth()`
- **Extras**: `EXTRA_PACKAGE_NAME`, `EXTRA_AUTH_REASON`
- **Result**: Broadcast `ACTION_BIOMETRIC_RESULT` via LocalBroadcastManager

### AutofillSettingsActivity
```xml
<activity
    android:name=".autofill.AutofillSettingsActivity"
    android:exported="true" />
```
- **No intent-filter** - Launched explicitly
- **Purpose**: Settings UI for autofill configuration
- **Exported**: true - Can be launched from system settings

---

## 7. Complete Initialization Sequence

### App Cold Start (User taps icon)
```
1. Zygote forks app process
2. Application.onCreate() (default)
3. FileProvider initialized
4. MainActivity.onCreate()
   └─ BridgeActivity.onCreate()
   └─ Capacitor Bridge init
   └─ WebView created
   └─ Load dist/index.html
   └─ React App bootstrap
   └─ KiyoAutofillPlugin.load() → AutofillRepository(context)
5. MainActivity.onStart() → onResume()
6. App interactive
```

### Autofill Service Enablement (User enables in Settings)
```
1. Settings → Autofill → Select "KIYO"
2. System: bindService(Intent(AutofillService), BIND_AUTOFILL_SERVICE)
3. KiyoAutofillService.onCreate()
   └─ AutofillRepository(context) → SQLiteOpenHelper
   └─ AutofillCrypto keyCache = empty
4. Service ready for onFillRequest/onSaveRequest
```

### Autofill Fill Request (User focuses login field in another app)
```
1. Target app: AutofillManager.requestFill()
2. System: Binds to KiyoAutofillService (if not running)
3. System: Calls service.onFillRequest(request, cancellationSignal, callback)
4. Service: executor.execute {
      └─ Parse AssistStructure.ViewNode tree
      └─ FieldDetector.findBestFieldCandidate() for username/password
      └─ Extract domain from webDomain
      └─ Repository.findMatchingAccounts(domain)
      └─ SecuritySession.get() → Check if unlocked
      └─ If locked: FillResponseBuilder.createAuthResponse() → callback.onSuccess()
      └─ If unlocked: FillResponseBuilder.createFillResponse() → callback.onSuccess()
   }
```

### Biometric Authentication Flow
```
1. Service.onFillRequest() → SecuritySession.get() == null
2. Service.openKiyoApp() → Intent(MainActivity, FLAG_ACTIVITY_NEW_TASK, "autofill_auth_required")
3. MainActivity.onNewIntent() or onCreate() → React receives extra
4. React UI: Shows biometric prompt → Calls KiyoAutofillPlugin → BiometricAuth
5. Biometric success → SecuritySession.save(key, false)
6. React: Calls plugin to trigger fill again OR Service receives broadcast
7. Service: LocalBroadcastManager receives BIOMETRIC_RESULT
8. Service: Retries fill request with unlocked session
```

---

## 8. Key Architecture Points

### Process Model
- **Main Process**: `com.kiyo.app` - MainActivity, React WebView, Plugins
- **Autofill Service Process**: Same process (default) - `KiyoAutofillService` runs in main process when bound
- **Shared Memory**: `SecuritySession` (in-memory), `AutofillCrypto.keyCache`, SQLite DB (`kiyo_autofill.db`)

### Data Flow
```
React (IndexedDB) 
    ↓ syncAccountsFromReact() 
KiyoAutofillPlugin 
    ↓ AutofillRepository.upsertAccount() 
SQLite (kiyo_autofill.db) 
    ↓ findMatchingAccounts() 
KiyoAutofillService.onFillRequest() 
    ↓ FillResponse 
Target App (Autofill)
```

### Security Model
- **Master Secret**: Hardcoded in `AutofillCrypto.MASTER_SECRET` (should use Android Keystore in production)
- **Key Derivation**: PBKDF2 (100,000 iterations) + AES-GCM
- **Session Key**: Stored in `SecuritySession` (process memory only)
- **Biometric**: Gates access to session key via `SecuritySession.save(key, isLock)`

---

## 9. Summary Table

| Entry Point | Type | Trigger | Key Class | Exported |
|-------------|------|---------|-----------|----------|
| App Launch | Activity | User taps icon | MainActivity | Yes (LAUNCHER) |
| Autofill Service | Service | System binds | KiyoAutofillService | Yes (BIND_AUTOFILL_SERVICE) |
| Biometric Auth | Activity | Service starts | KiyoBiometricActivity | No |
| Autofill Settings | Activity | Settings/Deep link | AutofillSettingsActivity | Yes |
| File Sharing | Provider | Other apps | FileProvider | No (grantUriPermissions) |
| JS-Native Bridge | Plugin | React calls | KiyoAutofillPlugin | N/A (Capacitor) |

---

## 10. Notable Implementation Details

1. **No Custom Application Class** - Uses default `android.app.Application`
2. **SingleTask Launch Mode** - MainActivity reused for biometric auth return
3. **Autofill Service in Main Process** - Shares memory with UI (SecuritySession, Crypto cache)
4. **Capacitor BridgeActivity** - MainActivity extends BridgeActivity for WebView hosting
5. **Plugin Registration in Constructor** - `KiyoAutofillPlugin` registered before `onCreate()`
6. **LocalBroadcastManager** - Used for biometric result communication (process-local)
7. **SQLite Cache** - Autofill DB synced from React IndexedDB, not primary storage