# KIYO Android Autofill Service - Implementation Plan

## Overview
This document describes the complete implementation of Android Autofill Service for the KIYO Password Manager app. The implementation enables autofill functionality for Android apps (API 26+) using Capacitor plugin architecture.

---

## Architecture Summary

### 1. Native Android Layer (Kotlin/Java)

#### Files Created/Modified:

| File | Purpose |
|------|---------|
| `android/app/src/main/java/com/kiyo/app/autofill/AutofillDatabaseHelper.kt` | SQLite database helper for autofill accounts cache |
| `android/app/src/main/java/com/kiyo/app/autofill/AutofillRepository.kt` | Repository layer for CRUD operations on autofill accounts |
| `android/app/src/main/java/com/kiyo/app/autofill/KiyoAutofillService.java` | Main AutofillService implementation (API 26+) |
| `android/app/src/main/java/com/kiyo/app/autofill/AutofillSettingsActivity.kt` | Settings activity for autofill service |
| `android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.java` | Capacitor plugin bridge for React-Native communication |

#### Key Components:

**AutofillDatabaseHelper.kt**
- SQLite database with `accounts` table
- Columns: id, username, password, title, packageName, domain, createdAt, updatedAt, favorite
- Indexes on packageName, domain, username for fast lookups

**AutofillRepository.kt**
- Data class `AutofillAccount` with @JvmField for Java interop
- CRUD operations: insert, upsert, update, delete
- Query methods: findByPackageName, findByDomain, searchByUsername, getAllAccounts
- **Critical**: `syncAccountsFromReact()` - React is source of truth, SQLite is cache only
- Parses React Account JSON structure to extract username/password

**KiyoAutofillService.java**
- Extends `AutofillService` (API 26+)
- Uses **reflection** for API 26+ compatibility (avoids compile-time dependency)
- Implements `onFillRequest()` - provides datasets for autofill UI
- Implements `onSaveRequest()` - captures credentials from apps
- Recursive view structure traversal for username/password fields
- Hint-based field detection (USERNAME, EMAIL, PASSWORD)

**KiyoAutofillPlugin.java**
- Capacitor plugin with methods:
  - `isAutofillEnabled()` - check autofill status
  - `requestAutofillEnable()` - open autofill settings
  - `ping()` - test communication
  - `getAutofillServiceInfo()` - detailed service info
  - `syncAccountsFromReact()` - sync from React (source of truth)
  - Account management: syncAccounts, getAccounts, addAccount, updateAccount, deleteAccount, toggleFavorite, getAccountCount, clearAllAccounts

### 2. React/TypeScript Layer

#### Files:

| File | Purpose |
|------|---------|
| `src/plugins/kiyautofill.ts` | Core plugin interface & types |
| `src/plugins/kiyautofill.android.ts` | Android-specific extended interface |
| `src/plugins/kiyautofill.web.ts` | Web fallback implementation |

#### Type Definitions:
- `AutofillAccount` - matches native AutofillAccount
- `AutofillAccountInput` - for creating accounts
- `AutofillAccountUpdate` - for updating accounts
- `SyncResult`, `GetAccountsResult`, etc. - response types

### 3. Android Manifest & Resources

**AndroidManifest.xml**
```xml
<uses-permission android:name="android.permission.BIND_AUTOFILL_SERVICE" />

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

**res/xml/autofill_service.xml**
```xml
<autofill-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/autofill_service_description"
    android:settingsActivity="com.kiyo.app.autofill.AutofillSettingsActivity" />
```

**res/values/strings.xml**
```xml
<string name="autofill_service_description">KIYO Password Manager Autofill Service</string>
<string name="autofill_service_settings_title">KIYO Autofill Settings</string>
```

---

## Data Flow

### 1. Initial Setup (App Launch)
```
React App Start
    → KiyoAutofill.ping() (verify plugin)
    → KiyoAutofill.isAutofillEnabled() (check status)
    → If not enabled: KiyoAutofill.requestAutofillEnable() (open settings)
    → User enables KIYO as autofill service
    → KiyoAutofill.syncAccountsFromReact(accountsJson) (sync all accounts)
```

### 2. Autofill Flow (User opens login screen in another app)
```
Android System detects autofillable fields
    → Calls KiyoAutofillService.onFillRequest()
    → Service gets packageName from FillRequest
    → Repository.findByPackageName(packageName)
    → Build Dataset(s) for each matching account
    → Return FillResponse with datasets
    → Android shows autofill UI with account suggestions
    → User selects account
    → Android fills username/password fields
```

### 3. Save Flow (User logs in to new app)
```
User enters credentials in app
    → Android detects new credentials
    → Calls KiyoAutofillService.onSaveRequest()
    → Service extracts username/password from view structure
    → Repository.upsertAccount() (save to local cache)
    → Optional: Notify React to sync back to main database
```

### 4. Sync Flow (React → Android)
```
React: User adds/updates account
    → React calls KiyoAutofillAndroid.syncAccountsFromReact(accountsJson)
    → Plugin calls AutofillRepository.syncAccountsFromReact()
    → Repository clears existing accounts, inserts all from React
    → React is source of truth; Android SQLite is cache only
```

---

## React Account Structure → AutofillAccount Mapping

React Account:
```typescript
interface Account {
  id: number;
  templateId: number;
  title: string;
  description?: string;
  tags: string[];
  favorite: boolean;
  fields: AccountField[];
  createdAt: number;
  updatedAt: number;
}

interface AccountField {
  id: string;
  accountId?: number;
  label: string;
  type: "text" | "password" | "email" | "number" | "textarea";
  value: string;
  order: number;
}
```

Mapping Logic (in `AutofillRepository.parseReactAccount()`):
- **username**: First field with type="email", or label matching "username"/"user"/"id"/"login", or first text field
- **password**: Field with type="password"
- **domain**: Extracted from field with label "url"/"website"/"domain"
- **packageName**: From field with label "package"/"package name"/"app"/"application"
- **title**: Account title
- **favorite**: Account favorite flag
- **createdAt/updatedAt**: Account timestamps

---

## Build Configuration

### android/app/build.gradle
```gradle
android {
    defaultConfig {
        minSdkVersion 24  // Autofill requires API 26+, but app supports 24+
        targetSdkVersion 34
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = '1.8'
    }
}

dependencies {
    implementation "androidx.appcompat:appcompat:1.6.1"
    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.0"
    // Capacitor dependencies...
}
```

### capacitor.config.ts
```typescript
{
  plugins: {
    KiyoAutofill: {
      // Plugin configuration if needed
    }
  }
}
```

---

## Testing Checklist

### Unit Tests (Native)
- [ ] AutofillDatabaseHelper: create/upgrade database
- [ ] AutofillRepository: CRUD operations
- [ ] AutofillRepository: syncAccountsFromReact parsing
- [ ] KiyoAutofillService: reflection initialization
- [ ] KiyoAutofillService: extractCredentialsFromSaveRequest

### Integration Tests
- [ ] Plugin communication: ping()
- [ ] Autofill status check: isAutofillEnabled()
- [ ] Open settings: requestAutofillEnable()
- [ ] Sync accounts: syncAccountsFromReact()
- [ ] Account management: add/get/update/delete

### Manual Testing (Device/Emulator API 26+)
- [ ] Enable KIYO as autofill service in Settings
- [ ] Open app with login form (e.g., Chrome, test app)
- [ ] Verify autofill suggestion appears
- [ ] Select account → verify fields filled
- [ ] Save new credentials → verify saved in KIYO
- [ ] Sync from React → verify accounts appear in autofill

---

## Known Limitations & Future Improvements

### Current Limitations
1. **Reflection-based implementation** - May break on future Android versions
2. **No web autofill** - Only native Android apps supported
3. **Single dataset per account** - No multiple username support per app
4. **Settings activity is minimal** - No actual settings UI yet

### Future Improvements
1. **Migrate to direct API 26+ imports** (drop reflection when minSdk >= 26)
2. **Add web autofill support** via WebView or custom keyboard
3. **Implement AutofillSettingsActivity** with proper UI
4. **Add biometric authentication** before showing credentials
5. **Support multiple usernames per app/domain**
6. **Add autofill for OTP/2FA fields**
7. **Implement credential sharing** between apps/websites

---

## Deployment Notes

### Release Build
```bash
cd android
./gradlew assembleRelease
```

### Debug Build
```bash
cd android
./gradlew assembleDebug
```

### Testing on Device
1. Enable USB debugging
2. Install APK: `adb install app/build/outputs/apk/debug/app-debug.apk`
3. Open Settings → System → Languages & input → Advanced → Autofill service
4. Select "KIYO Password Manager Autofill Service"
5. Open KIYO app, unlock vault
6. Test autofill in other apps

---

## File Structure Summary

```
android/app/src/main/
├── java/com/kiyo/app/
│   ├── autofill/
│   │   ├── AutofillDatabaseHelper.kt      # SQLite helper
│   │   ├── AutofillRepository.kt          # Repository (Kotlin)
│   │   ├── AutofillRepository.java        # Empty (legacy)
│   │   ├── KiyoAutofillService.java       # AutofillService
│   │   └── AutofillSettingsActivity.kt    # Settings activity
│   └── capacitor/
│       └── KiyoAutofillPlugin.java        # Capacitor plugin
├── res/
│   ├── xml/
│   │   ├── autofill_service.xml           # Service metadata
│   │   └── file_paths.xml                 # FileProvider paths
│   └── values/
│       └── strings.xml                    # String resources
└── AndroidManifest.xml                    # Manifest with service

src/plugins/
├── kiyautofill.ts                         # Core interface
├── kiyautofill.android.ts                 # Android extensions
└── kiyautofill.web.ts                     # Web fallback
```

---

## Version Compatibility

| Component | Min Version | Notes |
|-----------|-------------|-------|
| Android Autofill API | API 26 (Android 8.0) | Required for AutofillService |
| App minSdkVersion | API 24 | App runs on older, autofill disabled |
| Capacitor | 5.x+ | Current version |
| Kotlin | 1.9+ | For repository |
| Java | 8+ | For plugin/service |

---

## Security Considerations

1. **BIND_AUTOFILL_SERVICE permission** - Only system can bind to service
2. **android:exported="true"** - Required for system to discover service
3. **Local SQLite cache** - Not encrypted (autofill needs fast access)
4. **React is source of truth** - Encrypted database in React layer
5. **No credentials in logs** - Only usernames/package names logged
6. **Biometric auth** - Recommended for future (before showing credentials)

---

## Troubleshooting

### Autofill not appearing
1. Check `isAutofillEnabled()` returns `enabled: true`
2. Verify KIYO is selected in Settings → Autofill service
3. Check logcat for `KiyoAutofillService` logs
4. Ensure app has login fields with proper autofill hints

### Sync not working
1. Verify `syncAccountsFromReact()` called with valid JSON
2. Check logcat for `AutofillRepository` sync logs
3. Ensure React accounts have password fields

### Build errors
1. Clean build: `./gradlew clean assembleDebug`
2. Check Kotlin/Java version compatibility
3. Verify all imports resolve correctly

---

*Document generated: 2025-07-17*
*Implementation status: COMPLETE - Build successful*