---
type: component
title: Account Detail Page
description: View account details, copy credentials, and perform account actions.
tags: [page, account, detail, view, credentials]
---
# Account Detail Page

The Account Detail page (`/src/pages/Accounts/AccountDetail.tsx`) displays complete information for a specific account, allowing users to view credentials, copy to clipboard, and perform actions like editing, deleting, or favoriting the account.

## Purpose

The Account Detail page provides:
1. **Full Account View**: Display all account fields and metadata
2. **Secure Credential Access**: View/copy passwords, TOTP codes, and sensitive fields
3. **Account Actions**: Edit, delete, favorite, tag, and export account
4. **Security Features**: Re-authentication for sensitive operations, clipboard protection
5. **Related Information**: Show usage statistics, related templates, and history
6. **Platform Integration**: Share account, suggest password changes, etc.

## Route and Navigation

- **Path**: `/accounts/:id` (where `:id` is the account ID)
- **Access Control**: Protected by `useFileAuthGuard` hook (requires open vault)
- **Navigation Targets**:
  - `/accounts/:id/edit` - Edit this account
  - `/accounts` - Return to account list
  - `/` - Return to Home dashboard
  - `/templates` - Manage templates
  - `/settings` - Application settings

## Components and State

### UI Structure
```
AccountDetailContainer
├── AppBar (Account name, back button, action menu)
├── AccountHeader (Icon, name, favorite star)
├── MetadataSection (Creation/update dates, usage stats)
├── CredentialsSection (Username, password, TOTP, etc.)
├── CustomFieldsSection (User-defined fields)
├── NotesSection (Free-form text area)
├── RelatedSection (Templates, history, suggestions)
└── Footer (Version, etc.)
```

### Account Data
- **account**: `Account` - The account being displayed (from route param)
- **loading**: `boolean` - Data loading state
- **error**: `string | null` - Error message if load failed
- **revealedFields**: `Set<string>` - Which sensitive fields are currently revealed
- **clipboardStatus**: `{field: string, status: 'copied' | 'cleared' | 'error'}` - Clipboard feedback

### Local UI State (React useState)
- **isEditing**: `boolean` - Whether in edit mode (navigates to edit page)
- **isDeleting**: `boolean` - Delete confirmation state
- **revealTimeouts**: `Map<string, NodeJS.Timeout>` - Auto-hide timers for revealed fields
- **clipboardClearing**: `boolean` - Whether clipboard auto-clear is active
- **shareSheetOpen**: `boolean` - Whether share dialog is open (mobile)
- **fieldFocus**: `string | null` - Currently focused field for keyboard navigation

## Key Sections

### Account Header
- **Leading Icon**: Service-based icon (website preset or custom)
- **Account Name**: Primary identifier (e.g., "Google", "GitHub")
- **Favorite Toggle**: Star icon to mark/unmark as favorite
- **Account Type**: Badge or label indicating account category
- **Security Indicators**: Lock icon if 2FA enabled, etc.

### Metadata Section
- **Created Date**: When account was first created
- **Updated Date**: Last time account was modified
- **Usage Count**: Number of times used for autofill (if tracked)
- **Last Used**: Timestamp of last autofill usage
- **Age**: Relative time ("Created 2 years ago")
- **Version**: Internal account format version
- **Source**: Imported, created from template, etc.

### Credentials Section
Displays sensitive information with protection:

#### Username/Email
- **Default View**: Masked (first char + asterisks, e.g., "j*****@g*****.com")
- **Revealed State**: Full username/email on tap/hold
- **Copy Action**: Copy to clipboard with timeout clear
- **Validation**: Email format indicator if applicable

#### Password
- **Default View**: Completely hidden (●●●●●●●●)
- **Revealed State**: Full password on tap/hold + confirm
- **Copy Action**: Copy to clipboard with security warning + timeout
- **Strength Indicator**: Visual password strength (if implemented)
- **Age Warning**: Indicator if password is old (e.g., > 90 days)

#### TOTP/2FA
- **Default View**: Hidden or shows "Set up 2FA"
- **Active State**: Current 6-digit code + time remaining
- **Copy Action**: Copy current code to clipboard
- **Refresh**: Auto-updates every 30 seconds
- **Setup Guide**: Link to service's 2FA setup if not configured

#### URL/Website
- **Default View**: Full URL (usually non-sensitive)
- **Action**: Open in browser (with confirmation)
- **Copy Action**: Copy URL to clipboard
- **Validation**: Valid URL indicator
- **Launch**: Open associated app if installed (Android intents)

### Custom Fields Section
- **Dynamic Rendering**: Based on account.fields array
- **Field Types**: 
  - **text**: Single line input
  - **email**: Email-input optimized
  - **password**: Password input with reveal/copy
  - **textarea**: Multi-line text area
  - **select**: Dropdown with predefined options
  - **url**: URL input with validation/launch
  - **totp**: TOTP field with auto-refresh
  - **phone**: Phone number input
  - **date**: Date picker
  - **time**: Time picker
  - **color**: Color picker
- **Field Label**: User-defined label for each field
- **Field Value**: Encrypted value (decrypted only for viewing/copy)
- **Field Actions**: Copy to clipboard (with security as needed)
- **Field Order**: Drag-and-drop reordering (if implemented in edit mode)

### Notes Section
- **Free-form Text**: Multi-line encrypted text field
- **View Mode**: Read-only display
- **Edit Mode**: Navigate to edit page to modify
- **Character Count**: Show remaining/used characters
- **Formatting**: Preserve line breaks and basic formatting
- **Attachments**: Show attached file count/icons (if implemented)

### Related Section
- **Template Origin**: Show which template this account was created from
- **Similar Accounts**: Suggest accounts with similar service names
- **Password Health**: 
  - Age of password
  - Reuse detection (if implemented across accounts)
  - Strength assessment
- **Security Recommendations**: 
  - "Consider enabling 2FA"
  - "Password is old, consider changing"
  - "This password appears in other accounts"
- **Export Options**: 
  - Export single account
  - Export as part of backup
  - Share via platform share sheet

## Security Implementation

### Field Protection Levels
Different fields have different protection requirements:

#### Level 1: Basic Protection (Username, URL, Notes)
- **Viewing**: No re-authentication required
- **Copying**: No re-authentication required
- **Timeout**: No auto-clear (non-sensitive)
- **Indicators**: Standard visual treatment

#### Level 2: Enhanced Protection (Email, Basic Text Fields)
- **Viewing**: Tap/hold to reveal (no auth)
- **Copying**: No re-authentication required
- **Timeout**: Short auto-clear (e.g., 15 seconds)
- **Indicators**: Slight visual distinction

#### Level 3: High Protection (Password, TOTP, Sensitive Fields)
- **Viewing**: 
  - Tap/hold to reveal (may require auth based on settings)
  - Optional: Require re-authentication for reveal
  - Visual indication of protection level
- **Copying**: 
  - May require re-authentication based on settings
  - Always includes timeout clear
  - Security warning before copying
- **Timeout**: Standard auto-clear (e.g., 30 seconds)
- **Indicators**: Prominent visual protection indicators

### Authentication Requirements
Configurable via settings:
- **Never Require Auth**: For copying/viewing any field
- **Require for Passwords**: Auth needed to copy/view passwords
- **Require for Sensitive**: Auth needed for passwords, TOTP, custom sensitive fields
- **Always Require Auth**: Auth needed for any field reveal/copy

### Biometric Integration
- **Android BiometricPrompt**: For secure authentication
- **Fallback to PIN**: If biometric unavailable or fails
- **Timeout**: Remember auth for X seconds to reduce prompts
- **Operation-specific**: Different timeout for different operations
- **Fallback Chain**: Biometric → PIN → Lockout

### Clipboard Security
- **Auto-clear Timers**: 
  - Username/Email: 15 seconds (configurable)
  - Password/TOTP: 30 seconds (configurable)
  - Other fields: 45 seconds (configurable)
- **Platform APIs**: 
  - Android: Secure clipboard APIs when available
  - iOS: UIPasteboard with expiration
  - Web: Standard clipboard with timeout
- **User Feedback**: 
  - Toast/snackbar on copy: "Copied • clears in Xs"
  - Toast on clear: "Clipboard cleared"
  - Visual indicator in UI when clipboard has sensitive data
- **Confirmation**: Optional requirement to confirm before copy

### Screen Protection
- **Screenshot Prevention**: 
  - FLAG_SECURE equivalent where possible
  - Warning if screenshot detected (best effort)
- **Shoulder Surfing Resistance**:
  - Large tap targets for reveal/copy
  - Optional field masking during reveal
  - Delayed reveal (show after 500ms tap/hold)
  - Position randomization for re-auth prompts
- **Overlay Protection**: 
  - Prevent overlay attacks that could capture screen
  - Secure flag for window (where available)

### Memory Protection
- **Selective Decryption**: Only decrypt fields when revealed
- **Immediate Zeroization**: Overwrite decrypted strings after use
- **Limited Scope**: Decrypted values exist only in function scope
- **No Storage**: Decrypted values never stored in state or props
- **Garbage Collection**: References cleared promptly after use

## Event Handlers

### Field Interaction Handlers
```typescript
const handleFieldTap = async (fieldId: string, fieldType: FieldType) => {
  // Check if field requires auth to reveal
  if (requiresAuthToReveal(fieldType)) {
    try {
      await verifyUserAuth();
    } catch (err) {
      showAuthError(err);
      return;
    }
  }
  
  // Reveal field
  setRevealedFields(prev => new Set(prev).add(fieldId));
  
  // Set auto-hide timeout
  const timeout = setTimeout(() => {
    setRevealedFields(prev => new Set(prev).delete(fieldId));
  }, getRevealTimeout(fieldType));
  
  revealTimeouts.set(fieldId, timeout);
};

const handleFieldCopy = async (fieldId: string, fieldType: FieldType) => {
  // Check if field requires auth to copy
  if (requiresAuthToCopy(fieldType)) {
    try {
      await verifyUserAuth();
    } catch (err) {
      showAuthError(err);
      return;
    }
  }
  
  try {
    // Decrypt field value
    const value = await decryptFieldValue(account, fieldId);
    
    // Copy to clipboard
    await navigator.clipboard.writeText(value);
    
    // Show feedback
    showCopyFeedback(fieldType);
    
    // Start auto-clear timer
    startClipboardAutoClear(getCopyTimeout(fieldType));
  } catch (err) {
    showCopyError(err);
  }
};

const handleFieldLongPress = (fieldId: string, fieldType: FieldType) => {
  // Alternative to tap/hold for reveal
  handleFieldTap(fieldId, fieldType);
};
```

### Account Action Handlers
```typescript
const handleEditAccount = () => {
  navigate(`/accounts/${accountId}/edit`);
};

const handleDeleteAccount = async () => {
  setIsDeleting(true);
  
  try {
    // Require auth for deletion if configured
    if (requiresAuthForDeletion()) {
      await verifyUserAuth();
    }
    
    // Perform deletion
    await deleteAccount(accountId);
    
    // Navigate back to list
    navigate('/accounts');
  } catch (err) {
    showError(err);
  } finally {
    setIsDeleting(false);
  }
};

const handleToggleFavorite = async () => {
  try {
    // Require auth for favorite toggle if configured
    if (requiresAuthForFavorite()) {
      await verifyUserAuth();
    }
    
    await toggleAccountFavorite(accountId);
    // UI updates via store subscription
  } catch (err) {
    showError(err);
  }
};

const handleExportAccount = async () => {
  try {
    // Require auth for export if configured
    if (requiresAuthForExport()) {
      await verifyUserAuth();
    }
    
    const encryptedAccount = await exportSingleAccount(accountId);
    
    // Trigger file save
    const result = await DocumentPicker.save({
      fileName: `${account.name}.kiyo`,
      type: [DocumentPicker.Types.Documents],
    });
    
    if (result) {
      await KiyoFile.writeToUri({
        uri: result.uri,
        data: encryptedAccount
      });
      
      showSuccess('Account exported successfully');
    }
  } catch (err) {
    showError(err);
  }
};

const handleShareAccount = async () => {
  // Similar to export but uses platform share sheet
  // May encrypt or share only non-sensitive data based on settings
};
```

### Metadata Handlers
```typescript
const handleViewUsageStats = () => {
  // Show modal with usage statistics
  // Times used, last used, frequency, etc.
};

const handleViewPasswordHistory = () => {
  // Show password change history (if implemented)
  // Dates, strength over time, etc.
};

const handleOpenUrl = async () => {
  if (!account.url) return;
  
  try {
    // Confirm opening external link
    const confirmed = await showOpenUrlConfirmation(account.url);
    if (!confirmed) return;
    
    // Try to open in associated app first (Android intents)
    const appOpened = await openInAssociatedApp(account.url);
    
    if (!appOpened) {
      // Fallback to browser
      await Linking.openURL(account.url);
    }
  } catch (err) {
    showError(err);
  }
};
```

## Empty and Error States

### Loading State
- **Skeleton Layout**: Gray placeholders matching section shapes
- **Progress Indicator**: Spinner or progress bar
- **Button States**: Disable actions during load
- **Retry Mechanism**: Not typically needed for single item load

### Error States
- **Load Failure**:
  - Message: "Failed to load account details"
  - Cause: Account not found, corrupted data, storage error
  - Actions: 
    - [Try Again] - Reload account data
    - [Go to List] - Return to accounts list
    - [Lock Vault] - Secure vault and return to auth
- **Decryption Failure**:
  - Message: "Unable to decrypt account data"
  - Cause: Incorrect vault encryption key, data corruption
  - Actions:
    - [Try Again] - Retry decryption
    - [Re-authenticate] - May require PIN/biometric re-verification
    - [Report Issue] - If persistent, may indicate vault corruption
- **Permission Denied**:
  - Message: "Permission required to perform this action"
  - Cause: Missing clipboard, filesystem, or other permissions
  - Actions:
    - [Grant Permission] - Open system settings
    - [Try Alternative] - Use manual selection/copy
    - [Cancel] - Abort operation

### Empty Field States
Some fields may be intentionally empty:
- **Optional Fields**: Show "Not set" or placeholder text
- **Missing Data**: Indicate if field should have data but doesn't
- **Unsupported Types**: Show type not supported message (for future fields)
- **Corrupted Data**: Show error icon with tooltip explaining issue

## Performance Optimization

### Rendering Efficiency
- **Selective Rendering**: Only render fields that exist in account
- **Memoization**: 
  - `useMemo` for decrypted field values (with proper dependencies)
  - `useMemo` for computed properties (age, strength, etc.)
- **Callback Stability**: `useCallback` for event handlers
- **Conditional Rendering**: Don't render sections with no data
- **Virtualization**: Not needed for single account detail view

### Data Fetching
- **Single Source**: Account from Zustand store via route param
- **Route Param Subscription**: Use `useParams` + store subscription
- **Optimistic Updates**: UI updates immediately for non-critical operations
- **Caching**: 
  - Decrypted values cached until account changes
  - Computed values (age, etc.) cached until dependencies change
  - TOTP codes cached with proper refresh interval
- **Immutable Updates**: Efficient reference checking prevents unnecessary renders

### TOTP Handling
- **Efficient Calculation**: 
  - Use Web Crypto API where available
  - Cache current interval code
  - Update only when interval changes
- **Visual Timer**: 
  - Progress bar showing time until next code
  - Seconds remaining counter
  - Auto-refresh every second for display
- **Error Handling**: 
  - Invalid secret: Show configuration error
  - Missing secret: Show setup prompt
  - Calculation error: Show generic error with retry

### Memory Management
- **Field Decryption**: 
  - Decrypt only when needed for reveal/copy
  - Immediately zeroize after use
  - Never store decrypted values in React state
- **Effect Cleanup**: 
  - Clear all timeouts on unmount
  - Remove event listeners
  - Cancel pending async operations
- **Subscription Cleanup**: 
  - Unsubscribe from account store changes
  - Remove route param listeners
  - Clean up any external listeners

## Testing

### Unit Tests
- **File**: `/src/pages/Accounts/AccountDetail.test.tsx`
- **Framework**: Vitest with React Testing Library
- **Scenarios**:
  - Component renders with account data
  - All sections display correctly based on account fields
  - Sensitive fields protected until revealed
  - Copy operations work with security checks
  - Navigation to edit/back works correctly
  - Favorite toggle updates account state
  - Delete confirmation works
  - Export functionality produces valid encrypted file
  - Error states show on load/decryption failure
  - Loading states display during data fetch
  - Field reveal/hide timing works correctly
  - TOTP display and auto-refresh works
  - URL opening works with confirmation
  - Metadata displays correctly (dates, usage, etc.)

### Integration Tests
- **File**: `/src/pages/Accounts/AccountDetail.integration.test.tsx`
- **Scenarios**:
  - Full flow: view account → copy password → verify clipboard
  - Favorite toggle persists and shows in lists
  - Delete account removes from list and storage
  - Export account creates valid importable file
  - Share account works with platform share sheet
  - Re-authentication prompts when configured for sensitive ops
  - Field reveal timing respects settings
  - Clipboard auto-clear works after timeout
  - Screen security measures functional (where testable)
  - Account updates reflect in detail view (if edited elsewhere)
  - Related sections show correct template/suggestions

### Manual Testing Checklist
- [ ] All account fields display correctly based on type
- [ ] Sensitive fields protected until user interaction
- [ ] Tap/hold to reveal works with appropriate timing
- [ ] Copy to clipboard functions for all field types
- [ ] Clipboard auto-clear after configured timeout
- [ ] Favorite toggle works and persists
- [ ] Edit navigation goes to correct edit page
- [ ] Delete confirmation works and removes account
- [ ] Export account creates valid .kiyo file
- [ ] Share account works via platform share sheet
- [ ] URL opening works with confirmation prompt
- [ ] Metadata shows correct timestamps and calculations
- [ ] TOTP displays current code and refreshes
- [ ] Error states show for invalid/missing account
- [ ] Loading states display during data fetch
- [ ] Re-authentication prompts when required by settings
- [ ] Field-level auth requirements work correctly
- [ ] Security warnings appear for sensitive operations
- [ ] Visual feedback for copy/clear/reveal actions
- [ ] Accessibility labels and screen reader announcements
- [ ] Touch targets meet minimum size requirements
- [ ] Keyboard navigation works (Tab/Enter/Space/Escape)
- [ ] Color contrast meets WCAG AA standards
- [ ] Platform-specific behaviors (Android back button, etc.)
- [ ] Long press/reveal mechanics work for secure fields
- [ ] Biometric re-authentication triggers when required
- [ ] Context menu appears on long press (if implemented)
- [ ] Scrolling performance is smooth in all sections
- [ ] Field validation works (email, URL, etc.)
- [ ] Custom field types render and function correctly
- [ ] Notes section handles large text appropriately
- [ ] Related sections show appropriate suggestions

## Source

### Primary Files
- `/src/pages/Accounts/AccountDetail.tsx` - Main component implementation
- `/src/pages/Accounts/AccountDetail.test.tsx` - Unit tests
- `/src/pages/Accounts/AccountDetail.integration.test.tsx` - Integration tests

### Supporting Files
- `/src/store/accountStore.ts` - Account state management
- `/src/database/accountTable.ts` - Account querying operations
- `/src/database/db.ts` - Dexie instance and table definitions
- `/src/models/account.ts` - Account and field type definitions
- `/src/models/template.ts` - Template definitions
- `/src/data/builtinTemplates.ts` - Built-in account templates
- `/src/hooks/useFileAuthGuard.ts` - Route protection hook
- `/src/hooks/useAccountDetail.ts` - Custom hook for account detail logic
- `/src/components/` - Reusable UI components (buttons, inputs, icons, cards)
- `/src/utils/search.ts` - Search and filtering algorithms
- `/src/utils/sort.ts` - Sorting utilities
- `/src/utils/tag.ts` - Tag management helpers
- `/src/utils/clipboard.ts` - Secure clipboard operations
- `/src/utils/validation.ts` - Input validation helpers
- `/src/utils/formatters.ts` - Account data formatting (username masking, etc.)
- `/src/utils/crypto.ts` - Cryptographic helpers for field decryption
- `/src/utils/totp.ts` - TOTP generation and validation
- `/src/utils/storage.ts` - File size and data storage helpers
- `/src/components/icons/` - Service-based icons and icon mapping
- `/src/components/feedback/` - Toast, snackbar, modal components

### Android Integration
- **Clipboard**: Uses secure clipboard APIs where available
- **Biometric**: `/openwiki/android/security/biometric-auth.md` for re-auth
- **App Links**: `/openwiki/android/autofill-service/response/` for URL handling
- **Share Intent**: Native share for exporting account data
- **Drag and Drop**: Optional for field reordering (if implemented)
- **Notifications**: System notifications for operation completion
- **Accessibility**: TalkBack compatibility and accessibility services
- **Overlay Protection**: Window flags to prevent screenshot/capture

### Related Pages
- **Auth Page**: `/openwiki/frontend/pages/auth.md` - Pre-auth entry point
- **Home Page**: `/openwiki/frontend/pages/home.md` - Dashboard overview
- **Accounts Page**: `/openwiki/frontend/pages/accounts.md` - Account list overview
- **Account Edit**: `/openwiki/frontend/pages/account-edit.md` - Account creation/editing
- **Templates Page**: `/openwiki/frontend/pages/templates.md` - Template management
- **Settings Page**: `/openwiki/frontend/pages/settings.md` - Configuration options
- **Template Edit**: `/openwiki/frontend/pages/template-edit.md` - Template creation/editing

## Data Flow

```
Zustand Accounts Store ←→ Dexie IndexedDB ←→ File System
      ↑                       ↓
Account State ← Persistence Layer ←→ Sync (if implemented)
      ↑                       ↓
AccountDetail Component ← React State ← UI Events
      ↑                       ↓
Field Display ←→ Protection Logic ←→ Crypto Layer
      ↑                       ↓
Auth Prompts ←→ Biometric/PIN ←→ Android Keystore
      ↑                       ↓
Clipboard Ops ←→ Platform Clipboard ←→ OS Clipboard
      ↑                       ↓
Navigation Events ←→ React Router ←→ Browser History
      ↑                       ↓
Platform APIs ←→ Capacitor Bridge ←→ Native/Android
```

### Detailed Flow (Initial Load)
1. **Route Match**: User navigates to `/accounts/:id` (e.g., `/accounts/abc123`)
2. **Param Extraction**: `useParams()` extracts `id: "abc123"`
3. **Component Mount**: AccountDetail mounts, useEffect triggers
4. **Store Subscription**: 
   - Subscribe to accountStore for account changes
   - Filter to find account with matching ID
5. **Data Loading**: 
   - `useAccountStore(state => state.accounts.find(acc => acc.id === id))`
   - If not found: show error state
   - If found: proceed with display
6. **Initial Processing**: 
   - Extract field metadata from account object
   - Compute derived values (age, usage stats, etc.)
   - Set up TOTP interval tracking if applicable
7. **UI Render**: 
   - Show skeleton/loading state initially
   - Replace with actual account data when available
   - Render all sections based on account fields
8. **User Interaction**: 
   - Tap field → check auth requirements → reveal if allowed
   - Copy field → check auth requirements → copy if allowed
   - Tap favorite → check auth requirements → toggle if allowed
   - Tap edit → navigate to edit page
   - Tap delete → show confirmation → delete if confirmed
   - Tap export → check auth requirements → export if allowed
   - Tap share → prepare data → show share sheet

### Detailed Flow (Field Reveal with Auth)
1. **User Action**: Taps password field to reveal
2. **Handler Call**: `handleFieldTap(passwordFieldId, 'password')`
3. **Auth Check**: 
   - Check settings: `requiresAuthToReveal('password')` returns true
   - Initiate auth flow: `verifyUserAuth()`
   - Show PIN/biometric prompt to user
4. **User Authentication**: 
   - User enters correct PIN or uses biometric
   - Auth promise resolves successfully
5. **Field Reveal**: 
   - Add fieldId to revealedFields state
   - Set revealTimeouts timer (e.g., 10000ms for 10s reveal)
   - Start visual countdown if implemented
6. **UI Update**: 
   - Password field changes from ●●●●●● to actual password value
   - Show "tap to hide" indicator or similar
   - Update field appearance to show revealed state
7. **Auto-hide**: 
   - After timeout: remove fieldId from revealedFields
   - UI updates to hide password again
   - Clear timeout reference
   - Optionally show "hidden" feedback
8. **Early Hide**: 
   - User taps field again before timeout
   - Handler calls same function
   - Sees fieldId already in revealedFields
   - Immediately hides field (toggle behavior)
   - Clears existing timeout and sets new one if needed

### Detailed Flow (Field Copy with Auth)
1. **User Action**: Taps copy icon on password field
2. **Handler Call**: `handleFieldCopy(passwordFieldId, 'password')`
3. **Auth Check**: 
   - Check settings: `requiresAuthToCopy('password')` returns true
   - Initiate auth flow: `verifyUserAuth()`
   - Show PIN/biometric prompt to user
4. **User Authentication**: 
   - User provides correct credentials
   - Auth promise resolves
5. **Field Decryption**: 
   - Retrieve encrypted password value from account.fields
   - Get vault encryption key from session store
   - Decrypt using AES-GCM with stored IV/salt
   - Return plaintext password string
6. **Clipboard Operation**: 
   - Write plaintext password to navigator.clipboard
   - Show toast: "Password copied • clears in 30s"
   - Start clipboardAutoClear timer (30000ms)
7. **State Management**: 
   - No account state changes (read-only operation)
   - Clipboard state managed by browser/OS
   - Decrypted password zeroized immediately after use
   - No storage of plaintext in React state or props
8. **Auto-clear**: 
   - After 30 seconds: overwrite clipboard with empty string
   - Show toast: "Clipboard cleared"
   - Clear clipboard clearing reference
   - Reset clipboard status UI
9. **Error Handling**: 
   - If decryption fails: show "Failed to copy password"
   - If clipboard API unavailable: show fallback instructions
   - If user cancels auth: show "Copy cancelled"
   - Network/state errors: show generic error with retry option

### Detailed Flow (Favorite Toggle)
1. **User Action**: Taps favorite star icon in header
2. **Handler Call**: `handleToggleFavorite()`
3. **Auth Check** (if configured): 
   - Check settings: `requiresAuthForFavorite()` 
   - If true: initiate auth flow and wait for success
4. **State Update**: 
   - Optimistically toggle account.favorite in account store
   - Account store updates Zustand state
5. **Persistence**: 
   - Account store triggers accountTable.update(id, {favorite: !oldValue})
   - Dexie updates IndexedDB record
   - Wait for successful write confirmation
6. **UI Update**: 
   - Account store change triggers re-subscription
   - Component re-renders with updated account data
   - Favorite star updates to reflect new state (filled/empty)
   - Optional: show brief success toast
7. **Error Handling**: 
   - If persistence fails: show error toast
   - Optionally revert optimistic update
   - Keep user on detail page to retry
8. **Related Updates**: 
   - Home page favorite count updates via store subscription
   - Accounts list filters/show favorites only updates
   - Any other subscribed components update accordingly

### Detailed Flow (Delete Account)
1. **User Action**: Taps delete icon in header menu
2. **Handler Call**: `handleDeleteAccount()`
3. **Confirmation**: 
   - Show modal: "Delete this account? This action cannot be undone."
   - Buttons: [Cancel] [Delete]
4. **User Confirmation**: User taps "Delete" button
5. **Auth Check** (if configured): 
   - Check settings: `requiresAuthForDeletion()`
   - If true: initiate auth flow and wait for success
6. **Deletion Process**: 
   - Call accountTable.delete(accountId) on IndexedDB
   - Wait for successful deletion confirmation
   - Account store removes account from state
7. **Navigation**: 
   - On success: navigate back to accounts list (`/accounts`)
   - Show success toast: "Account deleted"
   - Clear any revealed field states
8. **State Update**: 
   - Account store change triggers re-subscriptions
   - Accounts list re-renders without deleted account
   - Home page statistics update (account count, etc.)
   - Tag usage counts adjust if deleted account had tags
9. **Error Handling**: 
   - If deletion fails: show error toast
   - Keep user on detail page to retry
   - Optionally show specific error (e.g., "Account not found")
10. **Cleanup**: 
    - Clear all revealed field timeouts
    - Reset clipboard state
    - Clear any external listeners/timeouts

### Detailed Flow (Export Account)
1. **User Action**: Taps export icon in header menu
2. **Handler Call**: `handleExportAccount()`
3. **Auth Check** (if configured): 
   - Check settings: `requiresAuthForExport()`
   - If true: initiate auth flow and wait for success
4. **Account Preparation**: 
   - Retrieve full account data from account store
   - Generate encryption salt (random bytes)
   - Derive encryption key from vault PIN (would require re-auth in practice)
   - Encrypt account JSON with AES-GCM
   - Format as KIYO single-account file structure
5. **File System Interaction**: 
   - Trigger file save dialog via DocumentPicker.save()
   - Suggest filename: `${account.name}.kiyo`
   - Wait for user to select save location
   - Write encrypted bytes to selected URI
6. **Completion**: 
   - On success: show success toast "Account exported"
   - On failure: show error toast with details
   - On cancel: no feedback (user-initiated cancel)
7. **State Management**: 
   - No account state changes (read-only operation)
   - Plaintext account data only exists in memory during encryption
   - Zeroize plaintext immediately after encryption
   - Encrypted bytes handled by file system APIs only
8. **Error Handling**: 
   - If encryption fails: show "Failed to prepare account for export"
   - If file picker unavailable: show "Export not available on this platform"
   - If write fails: show "Failed to save exported file"
   - If user cancels auth: show "Export cancelled"
   - Provide retry option for recoverable errors

### Detailed Flow (Share Account)
1. **User Action**: Taps share icon in header menu
2. **Handler Call**: `handleShareAccount()`
3. **Auth Check** (if configured): 
   - Check settings: `requiresAuthForShare()`
   - If true: initiate auth flow and wait for success
4. **Data Preparation**: 
   - Based on sharing settings:
     - Option A: Encrypt full account (like export) → share encrypted blob
     - Option B: Share only non-sensitive fields (name, username, URL, etc.)
     - Option C: Share encrypted account + require passphrase (not implemented)
5. **Platform Share Sheet**: 
   - Prepare data based on selected option
   - Trigger platform share sheet (Android Intent.ACTION_SEND, iOS UIActivityViewController)
   - Provide MIME type and data appropriately
   - Add subject/message if applicable (e.g., "KIYO Account: Google")
6. **Completion**: 
   - On share completed/success: no specific feedback (platform-handled)
   - On share failed/cancelled: show appropriate toast
   - On unsupported platform: show "Share not available" message
7. **State Management**: 
   - No account state changes (read-only)
   - Plaintext data only exists in memory during preparation
   - Zeroize plaintext immediately after use
   - Handle only encrypted or non-sensitive data for sharing
8. **Error Handling**: 
   - If preparation fails: show "Failed to prepare account for sharing"
   - If share sheet unavailable: show "Share not available on this device"
   - If user cancels auth: show "Share cancelled"
   - Platform-specific errors handled gracefully

### Detailed Flow (URL Opening)
1. **User Action**: Taps URL field or open link button
2. **Handler Call**: `handleOpenUrl()`
3. **Validation**: 
   - Check if account.url exists and is valid URL
   - Show error if missing/invalid
4. **Confirmation**: 
   - Show modal: "Open https://example.com in external browser?"
   - Buttons: [Cancel] [Open]
5. **User Confirmation**: User taps "Open" button
6. **App Handling** (Android): 
   - Try to open URL in associated app first
   - Use Android Intents with ACTION_VIEW
   - Package resolution to find appropriate handler
   - Fallback to browser if no app handles the URL
7. **Browser Fallback**: 
   - Use Linking.openURL() or equivalent
   - Opens default browser with URL
   - Handles http/https, mailto, tel, etc. schemes appropriately
8. **Completion**: 
   - No specific feedback on success (platform-handled)
   - Show error if unable to open URL
   - User returns to detail page after external app/browser closes
9. **State Management**: 
   - No account state changes (read-only)
   - URL handling delegated to platform APIs
   - No sensitive data exposed in process
10. **Error Handling**: 
    - If no URL: show "No URL associated with this account"
    - If invalid URL: show "Invalid URL format"
    - If user cancels confirmation: no action, remain on page
    - If app/browser fails: show "Unable to open link"
    - Provide retry option or manual copy suggestion

### Detailed Flow (TOTP Display)
1. **Initial Load**: 
   - Check if account.totpSecret exists
   - If missing: show "Set up 2FA" prompt
   - If present: proceed with TOTP display
2. **TOTP Calculation**: 
   - Extract base32 secret from account.totpSecret
   - Get current Unix timestamp
   - Calculate time step (usually 30-second intervals)
   - Apply HMAC-SHA1 with secret and timestamp
   - Truncate to 6-digit code
3. **Display Rendering**: 
   - Show current 6-digit code in prominent display
   - Show time remaining until next code (e.g., "23s")
   - Show visual progress bar filling as time elapses
   - Update display every second for countdown
4. **Auto-refresh**: 
   - Use setInterval to recalculate every second
   - Clear and reset interval on component unmount
   - Pause when tab/window hidden (visibilitychange)
   - Resume when tab/window visible again
5. **Copy Operation**: 
   - Similar to field copy but for TOTP code
   - May require auth based on settings
   - Copy current valid code to clipboard
   - Start auto-clear timer (typically 15-30s)
6. **Error Handling**: 
   - If secret invalid: show "Invalid 2FA configuration"
   - If secret missing: show "2FA not configured for this account"
   - If calculation fails: show "Unable to generate code"
   - Provide re-setup instructions or link to service
7. **Security**: 
   - TOTP treated as high-protection field (like password)
   - Same auth requirements for reveal/copy
   - Same timeout clear behavior
   - Same visual protection indicators

### Detailed Flow (Metadata Display)
1. **Creation Date**: 
   - Extract account.createdAt timestamp
   - Convert to Date object
   - Format as relative time ("Created 2 years ago") or absolute date
   - Show in metadata section with appropriate label
2. **Updated Date**: 
   - Extract account.updatedAt timestamp
   - Convert to Date object
   - Format similarly to creation date
   - Show if different from creation date
3. **Usage Statistics** (if tracked): 
   - Retrieve usage count from account metadata or separate tracking
   - Show "Used X times" or similar
   - Show last used timestamp if available
   - Calculate frequency if historical data exists
4. **Age Calculations**: 
   - Account age: now - createdAt
   - Password age: now - passwordUpdatedAt (if tracked)
   - Format appropriately (days, months, years)
   - Show warnings if exceeding thresholds (e.g., password > 90 days)
5. **Version Info**: 
   - Show internal account format version
   - Indicate if migration available/recommended
   - Show compatibility notes if version is old
6. **Source Information**: 
   - Show if created from template (which template)
   - Show if imported (from which file/date)
   - Show if created manually
   - Add appropriate icons/badges for source type