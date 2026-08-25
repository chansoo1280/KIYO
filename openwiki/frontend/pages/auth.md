---
type: component
title: Auth Page
description: PIN/biometric unlock, file selection, and vault initialization.
tags: [page, auth, authentication, pin, biometric, vault]
---
# Auth Page

The Auth page (`/src/pages/Auth.tsx`) is the entry point for accessing KIYO's vault functionality. It handles user authentication via PIN or biometric methods, vault creation/opening, and file selection for import/export operations.

## Purpose

The Auth page provides:
1. **Vault Access**: Authenticate users to access their encrypted vault data
2. **PIN Authentication**: Secure PIN-based unlock with retry limits
3. **Biometric Authentication**: Fingerprint/face ID unlock via Android Keystore
4. **Vault Management**: Create new vaults or open existing ones
5. **File Operations**: Select files for import/export of vault data
6. **Security Features**: Auto-lock integration, secure input handling, clipboard protection

## Route and Navigation

- **Path**: `/auth` (defined in `App.tsx`)
- **Entry Point**: First screen shown when app launches with no active session
- **Exit Condition**: Navigates to Home page (`/`) upon successful authentication
- **Guarded Routes**: All other pages use `useFileAuthGuard` hook to require auth

## Components and State

### UI Structure
```
AuthContainer
├── Header (App logo and title)
├── TabBar (Unlock / Create tabs)
├── Active Tab Content
│   ├── Unlock Tab: PIN input, biometric button, file selector
│   └── Create Tab: Vault name, PIN confirmation, file selector
├── Footer (Version info, links)
└── ModalDialogs (Error messages, confirmations)
```

### Local State (React useState)
- **activeTab**: `"unlock"` | `"create"` - Controls which tab is displayed
- **vaultName**: `string` - Name for new vault (create tab)
- **pin**: `string` - Current PIN input (unlock tab)
- **confirmPin**: `string` - PIN confirmation (create tab)
- **selectedFile**: `File | null` - Selected file for import/export
- **isBiometricAvailable**: `boolean` - Biometric authentication availability
- **isUnlocking**: `boolean` - Loading state during auth operations
- **errorMessage**: `string | null` - Validation or auth error display

### Derived State
- **canUnlock**: `boolean` - PIN meets minimum length requirements
- **canCreate**: `boolean` - Form validation passes for vault creation
- **hasSelectedFile**: `boolean` - File selected for import/export

## Authentication Flow

### Unlock Existing Vault
1. **User Selects Tab**: Chooses "Unlock" tab
2. **File Selection (Optional)**: User can select a vault file to import
3. **PIN Entry**: User enters their PIN
4. **Biometric Option**: Tap biometric icon for fingerprint/face auth
5. **Validation**: 
   - PIN length ≥ 4 characters
   - File validation if selected (for import)
6. **Authentication Attempt**:
   - If file selected: Attempt to import vault from file
   - If no file: Attempt to open existing vault from IndexedDB
7. **Success**: 
   - Decrypt vault data using PIN-derived key
   - Store decrypted vault in session store
   - Navigate to Home page
   - Start auto-lock timer
8. **Failure**:
   - Show error message (invalid PIN, corrupted file, etc.)
   - Clear PIN input for retry
   - Increment failed attempt counter

### Create New Vault
1. **User Selects Tab**: Chooses "Create" tab
2. **Enter Vault Name**: User provides name for new vault
3. **Set PIN**: User enters and confirms PIN
4. **File Selection (Optional)**: User can select a vault file to import as template
5. **Validation**:
   - Vault name not empty
   - PIN length ≥ 4 characters
   - PIN and confirmation match
   - File validation if selected (for import)
6. **Creation Process**:
   - Generate encryption key from PIN
   - Create empty vault structure with provided name
   - Encrypt vault data with derived key
   - Persist encrypted vault to IndexedDB
   - If file selected: Import accounts/templates from file
7. **Success**:
   - Store new vault in session store
   - Navigate to Home page
   - Start auto-lock timer
8. **Failure**:
   - Show error message (validation, creation failed, etc.)
   - Clear inputs for retry

## Key Functions and Handlers

### PIN Handling
```typescript
const handlePinChange = (value: string) => {
  setPin(value);
  // Clear error on input
  if (errorMessage) setErrorMessage(null);
};

const handleConfirmPinChange = (value: string) => {
  setConfirmPin(value);
  // Clear error on input
  if (errorMessage) setErrorMessage(null);
};
```

### File Selection
```typescript
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Basic file validation
  if (!file.name.endsWith('.kiyo') && !file.name.endsWith('.json')) {
    setErrorMessage('Please select a valid KIYO vault file (.kiyo or .json)');
    return;
  }
  
  setSelectedFile(file);
  setErrorMessage(null);
};
```

### Biometric Authentication
```typescript
const handleBiometricAuth = async () => {
  setIsUnlocking(true);
  setErrorMessage(null);
  
  try {
    // Verify biometric auth
    const success = await biometricAuthenticate();
    if (!success) {
      throw new Error('Biometric authentication failed');
    }
    
    // Get vault ID from secure storage
    const vaultId = await getStoredVaultId();
    if (!vaultId) {
      throw new Error('No vault found for biometric unlock');
    }
    
    // Open vault (PIN handled via secure key)
    const vault = await openVaultWithBiometric(vaultId);
    await SessionStore.getState().login(vault);
    
    // Navigate home
    navigate('/');
  } catch (err) {
    setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
  } finally {
    setIsUnlocking(false);
  }
};
```

### Form Submission
```typescript
const handleUnlockSubmit = async () => {
  if (!canUnlock || isUnlocking) return;
  
  setIsUnlocking(true);
  setErrorMessage(null);
  
  try {
    if (selectedFile) {
      // Import vault from file
      const vault = await importVaultFromFile(selectedFile, pin);
      await SessionStore.getState().login(vault);
    } else {
      // Open existing vault
      const vault = await openVault(pin);
      await SessionStore.getState().login(vault);
    }
    
    navigate('/');
  } catch (err) {
    setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
  } finally {
    setIsUnlocking(false);
  }
};

const handleCreateSubmit = async () => {
  if (!canCreate || isUnlocking) return;
  
  setIsUnlocking(true);
  setErrorMessage(null);
  
  try {
    // Create new vault
    const vaultId = await createVault(vaultName, pin);
    
    // If file selected, import data into new vault
    if (selectedFile) {
      await importDataIntoVault(vaultId, selectedFile);
    }
    
    // Open the newly created vault
    const vault = await openVault(pin);
    await SessionStore.getState().login(vault);
    
    navigate('/');
  } catch (err) {
    setErrorMessage(err instanceof Error ? err.message : 'Vault creation failed');
  } finally {
    setIsUnlocking(false);
  }
};
```

## Security Implementation

### PIN Security
- **Input Protection**: 
  - `<input type="password">` masks input
  - Prevents clipboard copying in most browsers
  - Disables autocomplete/autofill
- **Memory Handling**: 
  - PIN stored in state only during session
  - Zeroed after use (where possible in JS)
  - Never persisted to storage
- **Validation**:
  - Minimum length: 4 characters
  - Maximum length: Typically 16-32 characters (UI limit)
  - Character set: Usually alphanumeric + special chars
- **Rate Limiting**:
  - Failed attempt counter
  - Increasing delays after consecutive failures
  - Temporary lockout after threshold (e.g., 5 attempts)

### Biometric Security
- **Android Integration**:
  - Uses `BiometricPrompt` API (API 28+) or support library
  - Keys stored in Android Keystore with user authentication binding
  - CryptoObject pattern prevents replay attacks
  - Biometric-bound keys unusable without fresh auth
- **Key Management**:
  - `kiyo_secure_master_key` in Keystore protects vault encryption key
  - Key never leaves Keystore in plaintext
  - Authentication required for each key use
- **Fallback**:
  - If biometric unavailable/not enrolled, falls back to PIN
  - System lock screen credentials required for enrollment

### File Handling Security
- **Import Validation**:
  - File extension checking (.kiyo, .json)
  - Content validation before decryption attempt
  - Size limits to prevent DoS
  - Magic number/header verification
- **Export Protection**:
  - Exported data encrypted with same PIN
  - No plaintext vault data ever leaves device
  - Secure temporary memory handling
- **Permission Model**:
  - Uses system file picker (no persistent file access)
  - File access limited to selected file only
  - No background file access capabilities

### Session Management
- **Memory Only**: 
  - Decrypted vault exists only in memory (Zustand store)
  - Never written to disk or localStorage
  - Zeroed on logout/app termination
- **Auto-Lock Integration**:
  - Session cleared on auto-lock timeout
  - Requires re-authentication after lock
  - Timer resets on user activity
- **Secure Storage**:
  - PIN-derived keys never stored
  - Only salt stored with encrypted data (necessary for verification)
  - Android Keystore protects master keys

## Error Handling and User Feedback

### Validation Errors
- **Field Validation**: 
  - Real-time validation as user types
  - Inline error messages under fields
  - Visual indication (red border/icon)
- **Form Validation**:
  - Prevent submission if invalid
  - Aggregate multiple errors
  - Clear on successful input

### Authentication Errors
- **PIN Errors**:
  - "Incorrect PIN" (after verification failure)
  - "Too many attempts" (with lockout timer)
  - "Vault not found" (when trying to open non-existent vault)
- **File Errors**:
  - "Invalid file format" (wrong extension or content)
  - "File too large" (exceeds size limits)
  - "Failed to read file" (permission or I/O error)
  - "Import failed" (corrupted or incompatible data)
- **System Errors**:
  - "Authentication service unavailable" (biometric failure)
  - "Storage error" (IndexedDB failure)
  - "Unknown error" (catch-all with logging)

### Loading States
- **Button States**:
  - Loading spinner during async operations
  - Disabled buttons prevent duplicate submissions
  - Visual feedback (color change, text update)
- **Page-Level**:
  - Optional full-screen loader for long operations
  - Skeleton screens for gradual loading
  - Progressive disclosure of UI elements

## Accessibility Considerations

### Screen Reader Support
- **Labels**: All inputs have associated `<label>` elements
- **Live Regions**: Error messages use `aria-live="assertive"`
- **Headings**: Proper heading hierarchy (h1, h2, h3)
- **Landmarks**: Use of `<header>`, `<main>`, `<footer>`
- **Tab Order**: Logical tab navigation sequence

### Touch Targets
- **Minimum Size**: 48x48 dp for all interactive elements
- **Spacing**: Adequate padding between touch targets
- **Icon Buttons**: Properly labeled for accessibility

### Color and Contrast
- **WCAG AA**: Text and background contrast ratios
- **Focus Visible**: Clear focus outlines for keyboard navigation
- **Error States**: Colorblind-friendly error indication (icons + text)

### Platform Conventions
- **Android**: Follows Material Design guidelines
- **iOS**: Adapts to Human Interface Guidelines (when applicable)
- **Web**: Respects browser accessibility features

## Testing

### Unit Tests
- **File**: `/src/pages/Auth.test.tsx`
- **Framework**: Vitest with React Testing Library
- **Scenarios**:
  - Tab switching and state updates
  - PIN input validation and formatting
  - File selection and validation
  - Biometric button enabling/disabling
  - Form submission enabling/disabling
  - Error message display and clearing
  - Loading state during async operations

### Integration Tests
- **File**: `/src/pages/Auth.integration.test.tsx`
- **Scenarios**:
  - Full unlock cycle with valid PIN
  - Failed unlock attempts and lockout
  - Vault creation and persistence
  - Import/export file operations
  - Biometric authentication flow
  - Auto-lock integration after auth
  - Navigation to protected routes

### Manual Testing Checklist
- [ ] PIN entry with masking and validation
- [ ] Biometric authentication (when available)
- [ ] Vault creation with name and PIN
- [ ] Import from .kiyo and .json files
- [ ] Export functionality (via Settings)
- [ ] Error handling for invalid inputs
- [ ] Auto-lock initiation after successful auth
- [ ] Navigation to Home page on success
- [ ] Prevention of navigation to protected routes without auth
- [ ] Screen reader announcements for key events
- [ ] Touch target sizes and spacing
- [ ] Orientation changes (portrait/landscape)
- [ ] Keyboard navigation (Tab/Enter/Space)

## Source

### Primary Files
- `/src/pages/Auth.tsx` - Main component implementation
- `/src/pages/Auth.test.tsx` - Unit tests
- `/src/pages/Auth.integration.test.tsx` - Integration tests

### Supporting Files
- `/src/store/sessionStore.ts` - Vault state management
- `/src/database/fileStorage.ts` - Vault persistence operations
- `/src/crypto/encryption.ts` - Encryption/decryption primitives
- `/src/plugins/kiyosecurekey.ts` - Biometric key storage bridge
- `/src/hooks/useAutoLock.ts` - Auto-lock timer integration
- `/src/hooks/useClipboard.ts` - Secure clipboard operations
- `/src/utils/validation.ts` - Input validation helpers
- `/src/components/` - Reusable UI components (buttons, inputs, etc.)

### Android Integration
- **Biometric Auth**: `/openwiki/android/security/biometric-auth.md`
- **Secure Key Storage**: `/openwiki/android/security/secure-key-manager.md`
- **Key Derivation**: `/openwiki/android/database/database-key-manager.md`
- **Vault Opening**: `/openwiki/android/autofill-service/auth-handler.md`

### Related Pages
- **Home Page**: `/openwiki/frontend/pages/home.md` - Post-auth landing page
- **Settings Page**: `/openwiki/frontend/pages/settings.md` - Import/export configuration
- **Account Pages**: `/openwiki/frontend/pages/accounts/` - Vault data interaction
- **Template Pages**: `/openwiki/frontend/pages/templates.md` - Template management

## Data Flow

```
User Interface → React State → Event Handlers →
  Authentication Logic ←→ Crypto Layer ←→ Storage Layer
  ↑                                    ↓
Android Biometrics ←→ Keystore ←→ Secure Key Plugin
  ↑                                    ↓
File System ←→ File Picker ←→ Import/Export Logic
```

### Detailed Flow (Unlock with File)
1. **UI**: User selects file via `<input type="file">`
2. **State**: `selectedFile` state updated with File object
3. **Event**: Form submit triggers `handleUnlockSubmit`
4. **Validation**: PIN length checked, file type validated
5. **Crypto**: 
   - `createCryptoKey(pin, saltFromFile)` if importing
   - `createCryptoKey(pin)` if opening existing vault
6. **Storage**:
   - `importVault(fileData, pin)` or `openVault(vaultId, pin)`
   - Dexie get/put operations on vaultTable
7. **Session**: Decrypted vault stored in `sessionStore.vault`
8. **Navigation**: `navigate('/')` to Home page
9. **Side Effect**: `useAutoLock` timer started/reset

### Detailed Flow (Biometric Unlock)
1. **UI**: User taps biometric icon
2. **Event**: `handleBiometricAuth` triggered
3. **Android**: 
   - `BiometricPrompt.authenticate()` called
   - User scans fingerprint/face
   - Keystore operation: `kiyo_secure_master_key` usage
4. **Key Release**: 
   - On success: Encrypted vault key released from Keystore
   - On failure: Key remains locked, auth counter incremented
5. **Crypto**: 
   - Released key used to decrypt vault encryption key
   - Vault key used to decrypt actual vault data
6. **Storage**: 
   - Retrieve vault ID from Secure Preferences
   - Get encrypted vault from IndexedDB
7. **Session**: Decrypted vault stored in session store
8. **Navigation**: Navigate to Home page
9. **Side Effect**: Auto-lock timer started