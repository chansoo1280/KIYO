# KIYO Android Autofill Service Implementation Plan

## Project Overview
- **Project**: KIYO (Password Manager)
- **Platform**: React + TypeScript + Vite + Capacitor 8.4.1
- **Android Package**: `com.kiyo.app`
- **Min SDK**: 24 (Android 7.0) - **Autofill requires API 26+**
- **Target/Compile SDK**: 36 (Android 14)
- **Capacitor**: v8.4.1 with BridgeActivity

---

## Current Architecture Analysis

### Android Structure
```
android/app/src/main/
├── java/com/kiyo/app/
│   └── MainActivity.java (extends BridgeActivity)
├── res/
│   ├── xml/
│   │   ├── config.xml (Capacitor config)
│   │   └── file_paths.xml (FileProvider paths)
│   └── values/
│       ├── strings.xml
│       └── styles.xml
└── AndroidManifest.xml
```

### Capacitor Configuration
- `capacitor.config.ts`: Basic config with `appId: "com.kiyo.app"`
- No custom plugins configured yet
- Uses `BridgeActivity` for React-Android bridge

### React-Android Bridge
- Uses `@capacitor/core` and `@capacitor/android`
- No custom Capacitor plugins yet
- Uses `@capacitor/filesystem` for file operations
- React communicates via Capacitor's JS bridge

---

## Android Autofill Service Requirements

### Minimum Requirements
- **minSdkVersion**: 26 (Android 8.0 Oreo) - **Current: 24, NEEDS UPDATE**
- **Permissions**: `android.permission.BIND_AUTOFILL_SERVICE`
- **Service Declaration**: In AndroidManifest.xml with meta-data
- **XML Configuration**: `autofill_service.xml` in `res/xml/`

### Key Components Needed
1. **AutofillService Implementation** (Kotlin)
2. **Autofill Service XML Configuration** (`res/xml/autofill_service.xml`)
3. **AndroidManifest.xml Updates** (service declaration + permissions)
4. **build.gradle Updates** (minSdk 26, autofill dependencies)
5. **React-Android Bridge** (Capacitor Plugin or MethodChannel)
6. **React Hook/Service** for Autofill communication

---

## Implementation Plan

### Phase 1: Android Native Layer (Kotlin)

#### 1.1 Update build.gradle (android/app/build.gradle)
```gradle
android {
    defaultConfig {
        minSdkVersion 26  // CHANGE FROM 24 to 26 (required for Autofill)
        // ...
    }
}

dependencies {
    // Add Autofill dependencies
    implementation "androidx.autofill:autofill:1.3.0"
    // For biometric authentication (optional but recommended)
    implementation "androidx.biometric:biometric:1.2.0-alpha04"
}
```

#### 1.2 Create Autofill Service XML Configuration
**File**: `android/app/src/main/res/xml/autofill_service.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<autofill-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/autofill_service_description"
    android:settingsActivity="com.kiyo.app.autofill.AutofillSettingsActivity" />
```

#### 1.3 Create Strings Resource
**File**: `android/app/src/main/res/values/strings.xml` (add to existing)
```xml
<string name="autofill_service_description">KIYO Password Manager Autofill Service</string>
<string name="autofill_service_settings_title">KIYO Autofill Settings</string>
```

#### 1.4 Create KiyoAutofillService.kt
**File**: `android/app/src/main/java/com/kiyo/app/autofill/KiyoAutofillService.kt`

Key responsibilities:
- Extend `AutofillService`
- Implement `onFillRequest()` - Fill credentials into apps
- Implement `onSaveRequest()` - Save new credentials
- Implement `onAuthenticationRequired()` - Biometric auth
- Communicate with React app via Capacitor Plugin

#### 1.5 Create Autofill Settings Activity (Optional)
**File**: `android/app/src/main/java/com/kiyo/app/autofill/AutofillSettingsActivity.kt`
- Settings screen for autofill preferences
- Biometric authentication settings
- Sync status with React app

#### 1.6 Update AndroidManifest.xml
```xml
<manifest ...>
    <!-- Add permission -->
    <uses-permission android:name="android.permission.BIND_AUTOFILL_SERVICE" />
    
    <application ...>
        <!-- Add Autofill Service -->
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
        
        <!-- Settings Activity (optional) -->
        <activity
            android:name=".autofill.AutofillSettingsActivity"
            android:exported="true"
            android:label="@string/autofill_service_settings_title">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.SETTINGS" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

---

### Phase 2: Capacitor Plugin for React-Native Bridge

#### 2.1 Create Capacitor Plugin Structure
```
android/app/src/main/java/com/kiyo/app/capacitor/
├── KiyoAutofillPlugin.java          # Main plugin class
├── AutofillPluginInterface.java     # Interface for JS bridge
└── AutofillEventListener.java       # Event listener interface
```

#### 2.2 KiyoAutofillPlugin.java
```java
package com.kiyo.app.capacitor;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "KiyoAutofill")
public class KiyoAutofillPlugin extends Plugin {
    
    @PluginMethod
    public void isAutofillEnabled(PluginCall call) { ... }
    
    @PluginMethod
    public void requestAutofillEnable(PluginCall call) { ... }
    
    @PluginMethod
    public void getCredentials(PluginCall call) { ... }
    
    @PluginMethod
    public void saveCredential(PluginCall call) { ... }
    
    @PluginMethod
    public void authenticateUser(PluginCall call) { ... }
    
    @PluginMethod
    public void lockAutofill(PluginCall call) { ... }
    
    @PluginMethod
    public void unlockAutofill(PluginCall call) { ... }
}
```

#### 2.3 TypeScript Definitions
**File**: `src/plugins/kiy-autofill.ts` (or in plugin package)
```typescript
import { registerPlugin } from '@capacitor/core';

export interface KiyoAutofillPlugin {
  isAutofillEnabled(): Promise<{ enabled: boolean }>;
  requestAutofillEnable(): Promise<void>;
  getCredentials(options: { packageName: string; usernames: string[] }): Promise<{ credentials: Credential[] }>;
  saveCredential(credential: Credential): Promise<void>;
  authenticateUser(options: { reason: string }): Promise<{ success: boolean }>;
  lockAutofill(): Promise<void>;
  unlockAutofill(): Promise<void>;
  
  // Event listeners
  addListener(eventName: 'autofillRequest', listener: (data: AutofillRequest) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'saveCredentialRequest', listener: (data: SaveRequest) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'authenticationRequired', listener: (data: AuthRequest) => void): Promise<PluginListenerHandle>;
}

export const KiyoAutofill = registerPlugin<KiyoAutofillPlugin>('KiyoAutofill');
```

---

### Phase 3: React Integration Layer

#### 3.1 Create Autofill Service (React)
**File**: `src/services/autofillService.ts`
```typescript
import { KiyoAutofill } from '@/plugins/kiy-autofill';
import { useAccountStore } from '@/store/accountStore';

export class AutofillService {
  private static instance: AutofillService;
  private listeners: Map<string, Function[]> = new Map();
  
  static getInstance(): AutofillService { ... }
  
  async initialize(): Promise<void> { ... }
  
  async handleAutofillRequest(request: AutofillRequest): Promise<void> { ... }
  
  async handleSaveRequest(request: SaveRequest): Promise<void> { ... }
  
  async handleAuthRequest(request: AuthRequest): Promise<void> { ... }
  
  // Bridge methods to native
  async getCredentialsForApp(packageName: string): Promise<Credential[]> { ... }
  async saveCredential(credential: Credential): Promise<void> { ... }
}
```

#### 3.2 Create React Hook
**File**: `src/hooks/useAutofill.ts`
```typescript
import { useEffect, useState, useCallback } from 'react';
import { AutofillService } from '@/services/autofillService';

export function useAutofill() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<AutofillRequest | null>(null);
  
  const autofillService = AutofillService.getInstance();
  
  useEffect(() => {
    // Initialize and setup listeners
    autofillService.initialize();
    
    const unsubscribeAutofill = autofillService.on('autofillRequest', handleAutofillRequest);
    const unsubscribeSave = autofillService.on('saveCredentialRequest', handleSaveRequest);
    const unsubscribeAuth = autofillService.on('authenticationRequired', handleAuthRequest);
    
    return () => {
      unsubscribeAutofill();
      unsubscribeSave();
      unsubscribeAuth();
    };
  }, []);
  
  // ... handler functions
  
  return {
    isEnabled,
    isLocked,
    pendingRequest,
    unlock: () => autofillService.unlockAutofill(),
    lock: () => autofillService.lockAutofill(),
    provideCredentials: (credentials: Credential[]) => autofillService.respondToAutofill(credentials),
    saveCredential: (credential: Credential) => autofillService.respondToSave(credential),
  };
}
```

#### 3.3 Create Autofill UI Components
**Files**:
- `src/components/AutofillPrompt.tsx` - Bottom sheet for credential selection
- `src/components/AutofillAuthPrompt.tsx` - Biometric/PIN auth dialog
- `src/components/AutofillSavePrompt.tsx` - Save new credential prompt

#### 3.4 Integrate with Existing Stores
- Update `store/accountStore.ts` to support autofill queries
- Add `getCredentialsForAutofill(packageName: string)` method
- Add biometric lock state to `store/sessionStore.ts`

---

### Phase 4: Android Autofill Service Implementation Details

#### 4.1 KiyoAutofillService.kt Key Methods

```kotlin
class KiyoAutofillService : AutofillService() {
    
    private val plugin: KiyoAutofillPlugin? = null
    
    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        // 1. Extract package name and field info
        // 2. Request credentials from React app via plugin
        // 3. Show authentication if needed
        // 4. Fill response with dataset
    }
    
    override fun onSaveRequest(
        request: SaveRequest,
        cancellationSignal: CancellationSignal,
        callback: SaveCallback
    ) {
        // 1. Extract entered credentials
        // 2. Send to React app for saving
        // 3. Show save confirmation UI
    }
    
    override fun onAuthenticationRequired(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        // Trigger biometric/PIN auth via plugin
    }
}
```

#### 4.2 Communication Flow

```
Android App (Autofill Request)
        ↓
KiyoAutofillService (onFillRequest)
        ↓
KiyoAutofillPlugin (Capacitor bridge)
        ↓
React App (AutofillService.handleAutofillRequest)
        ↓
Query Dexie/AccountStore for matching credentials
        ↓
Show AutofillPrompt UI (React)
        ↓
User selects credential
        ↓
React → Plugin → Service → FillCallback.onSuccess(dataset)
```

---

### Phase 5: Build & Configuration Updates

#### 5.1 Update android/variables.gradle
```gradle
ext {
    minSdkVersion = 26  // CHANGE FROM 24
    // ...
}
```

#### 5.2 Update capacitor.config.ts
```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kiyo.app",
  appName: "kiyo",
  webDir: "dist",
  plugins: {
    // Configure autofill plugin
    KiyoAutofill: {
      // Plugin config if needed
    }
  }
};

export default config;
```

#### 5.3 Add Plugin to package.json (if separate package)
```json
{
  "dependencies": {
    "@kiyo/autofill-plugin": "file:../kiy-autofill-plugin"
  }
}
```

---

## File Structure Summary

### New Files to Create

```
android/app/src/main/
├── java/com/kiyo/app/
│   ├── autofill/
│   │   ├── KiyoAutofillService.kt
│   │   └── AutofillSettingsActivity.kt (optional)
│   └── capacitor/
│       ├── KiyoAutofillPlugin.java
│       ├── AutofillPluginInterface.java
│       └── AutofillEventListener.java
├── res/
│   ├── xml/
│   │   └── autofill_service.xml
│   └── values/
│       └── strings.xml (add autofill strings)
└── AndroidManifest.xml (update)

src/
├── plugins/
│   └── kiyo-autofill.ts (TypeScript definitions)
├── services/
│   └── autofillService.ts
├── hooks/
│   └── useAutofill.ts
├── components/
│   ├── AutofillPrompt.tsx
│   ├── AutofillAuthPrompt.tsx
│   └── AutofillSavePrompt.tsx
└── store/
    ├── accountStore.ts (update)
    └── sessionStore.ts (update)
```

### Files to Modify

```
android/
├── app/build.gradle (add dependencies, minSdk 26)
├── variables.gradle (minSdkVersion = 26)
├── app/src/main/AndroidManifest.xml (add service + permission)
└── app/src/main/res/values/strings.xml (add strings)

capacitor.config.ts (add plugin config)
package.json (add plugin dependency if separate)
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1)
- [ ] Update minSdkVersion to 26
- [ ] Add autofill dependencies to build.gradle
- [ ] Create autofill_service.xml
- [ ] Update AndroidManifest.xml with service declaration
- [ ] Create basic KiyoAutofillService.kt skeleton

### Phase 2: Capacitor Plugin (Week 1-2)
- [ ] Create KiyoAutofillPlugin.java
- [ ] Define PluginMethod interfaces
- [ ] Create TypeScript definitions
- [ ] Register plugin in Capacitor

### Phase 3: Autofill Service Logic (Week 2)
- [ ] Implement onFillRequest in KiyoAutofillService
- [ ] Implement onSaveRequest
- [ ] Implement onAuthenticationRequired
- [ ] Add biometric authentication support

### Phase 4: React Integration (Week 2-3)
- [ ] Create AutofillService.ts
- [ ] Create useAutofill hook
- [ ] Build AutofillPrompt components
- [ ] Integrate with accountStore/sessionStore
- [ ] Add autofill settings to Settings page

### Phase 5: Testing & Polish (Week 3)
- [ ] Test autofill in various apps
- [ ] Test save credential flow
- [ ] Test biometric authentication
- [ ] Handle edge cases (locked app, no credentials, etc.)
- [ ] Add autofill enable/disable toggle in settings

---

## Key Technical Considerations

### 1. **minSdkVersion 26 Requirement**
- Current: 24 → Must update to 26
- This may affect existing users on Android 7.0/7.1
- Consider: Keep minSdk 24 but check API level at runtime for autofill

### 2. **Autofill Service Lifecycle**
- Service runs in separate process
- Must handle process death/restart
- Communicate with main app via IPC (Capacitor plugin)

### 3. **Security Considerations**
- Biometric authentication required for credential access
- Encrypt credentials in transit between service and app
- Lock autofill after timeout/background

### 4. **Capacitor Plugin Communication**
- Use `PluginCall` for async operations
- Use `addListener` for event streaming
- Handle plugin lifecycle (app may not be running)

### 5. **Data Synchronization**
- Autofill service needs access to encrypted database
- Option A: Share database via ContentProvider
- Option B: IPC to main app (preferred for security)
- Option C: Duplicate encrypted storage (not recommended)

---

## Testing Checklist

- [ ] Autofill service appears in Android Settings → Languages → Autofill
- [ ] Can enable/disable autofill service
- [ ] Username/password fields show autofill suggestion
- [ ] Credential selection UI appears
- [ ] Selected credential fills correctly
- [ ] Save prompt appears for new credentials
- [ ] Biometric authentication works
- [ ] Lock/unlock functionality works
- [ ] Works across app restarts
- [ ] Works after device reboot

---

## Dependencies to Add

```gradle
// android/app/build.gradle
dependencies {
    // Autofill
    implementation "androidx.autofill:autofill:1.3.0"
    
    // Biometric (for authentication)
    implementation "androidx.biometric:biometric:1.2.0-alpha04"
    
    // Capacitor (already present)
    implementation project(':capacitor-android')
}
```

---

## Next Steps

1. **Start with Phase 1**: Update build.gradle and create basic service structure
2. **Create Capacitor Plugin**: Bridge between Android service and React
3. **Implement React Integration**: Hooks, services, UI components
4. **Test End-to-End**: Verify autofill works in real apps

This plan provides a complete roadmap for implementing Android Autofill Service in the KIYO password manager app.