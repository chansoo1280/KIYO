---
type: overview
title: Table Modules
description: Individual table operation modules for account, template, and file tables with CRUD operations and querying.
tags: [database, table-modules, crud, querying, account, template, file]
---
# Table Modules

KIYO's table modules provide specialized CRUD operations and querying capabilities for each Dexie table. These modules encapsulate table-specific logic including validation, transformation, and complex queries while providing a clean interface for the rest of the application.

## Purpose

Table modules provide:
1. **Encapsulation**: Table-specific logic separated from general persistence
2. **Validation**: Input validation and data transformation per table
3. **Complex Queries**: Specialized query methods beyond basic CRUD
4. **Consistency**: Uniform error handling and return types
5. **Testability**: Isolated units for unit testing table operations
6. **Performance**: Optimized queries using table-specific indexes

## Module Structure

Each table module follows a consistent pattern:
- Located in `/src/database/table-modules/[tableName].ts`
- Exports functions for CRUD operations and specialized queries
- Uses the Dexie instance from `/src/database/db.ts`
- Includes proper TypeScript typing for parameters and return values
- Handles table-specific validation and transformation

### Account Table Module (`accountTable.ts`)
Handles operations on the `accountTable` which stores user credentials and account information.

#### Key Functions
```typescript
// Create account
export const addAccount = async (
  account: Omit<Account, "id"> // id is auto-generated
): Promise<number> => {
  const now = Date.now();
  const accountWithTimestamps: Account = {
    ...account,
    createdAt: now,
    updatedAt: now
  };
  return await db.accountTable.add(accountWithTimestamps);
};

// Get account by ID
export const getAccount = async (id: number): Promise<Account | undefined> => {
  return await db.accountTable.get(id);
};

// Get accounts by vault ID
export const getAccountsByVaultId = async (
  vaultId: string
): Promise<Account[]> => {
  return await db.accountTable
    .where('vaultId')
    .equals(vaultId)
    .toArray();
};

// Get accounts by domain (for autofill)
export const getAccountsByDomain = async (
  domain: string
): Promise<Account[]> => {
  return await db.accountTable
    .where('domain')
    .equals(domain.toLowerCase())
    .toArray();
};

// Get favorite accounts
export const getFavoriteAccounts = async (): Promise<Account[]> => {
  return await db.accountTable
    .where('favorite')
    .equals(true)
    .toArray();
};

// Search accounts by tag
export const getAccountsByTag = async (
  tag: string
): Promise<Account[]> => {
  return await db.accountTable
    .where('tag')
    .equals(tag)
    .toArray();
};

// Update account
export const updateAccount = async (
  id: number,
  changes: Partial<Account>
): Promise<number> => {
  const account = await db.accountTable.get(id);
  if (!account) throw new Error(`Account ${id} not found`);
  
  const updated: Account = {
    ...account,
    ...changes,
    updatedAt: Date.now()
  };
  
  return await db.accountTable.put(updated, id);
};

// Delete account
export const deleteAccount = async (id: number): Promise<void> => {
  await db.accountTable.delete(id);
};

// Bulk operations
export const bulkAddAccounts = async (
  accounts: Omit<Account, "id">[]
): Promise<number[]> => {
  const now = Date.now();
  const accountsWithTimestamps = accounts.map(account => ({
    ...account,
    createdAt: now,
    updatedAt: now
  }));
  return await db.accountTable.bulkAdd(accountsWithTimestamps);
};
```

#### Validation
- **Website URL**: Must be valid URL format
- **Domain**: Auto-normalized to lowercase, stripped of www prefix
- **Username/Password**: Required fields, minimum length validation
- **Tags**: Array of strings, duplicates removed
- **Favorite**: Boolean value

### Template Table Module (`templateTable.ts`)
Handles operations on the `templateTable` which stores account templates.

#### Key Functions
```typescript
// Create template
export const addTemplate = async (
  template: Omit<Template, "id"> // id is auto-generated
): Promise<number> => {
  const now = Date.now();
  const templateWithTimestamps: Template = {
    ...template,
    createdAt: now,
    updatedAt: now
  };
  return await db.templateTable.add(templateWithTimestamps);
};

// Get template by ID
export const getTemplate = async (id: number): Promise<Template | undefined> => {
  return await db.templateTable.get(id);
};

// Get templates by vault ID
export const getTemplatesByVaultId = async (
  vaultId: string
): Promise<Template[]> => {
  return await db.templateTable
    .where('vaultId')
    .equals(vaultId)
    .toArray();
};

// Get templates sorted by sortOrder
export const getTemplatesSorted = async (
  vaultId: string
): Promise<Template[]> => {
  return await db.templateTable
    .where('vaultId')
    .equals(vaultId)
    .sortBy('sortOrder');
};

// Search templates by name
export const searchTemplatesByName = async (
  searchTerm: string
): Promise<Template[]> => {
  const lowerSearch = searchTerm.toLowerCase();
  return await db.templateTable
    .filter(template => 
      template.name.toLowerCase().includes(lowerSearch) ||
      template.description.toLowerCase().includes(lowerSearch)
    )
    .toArray();
};

// Update template
export const updateTemplate = async (
  id: number,
  changes: Partial<Template>
): Promise<number> => {
  const template = await db.templateTable.get(id);
  if (!template) throw new Error(`Template ${id} not found`);
  
  const updated: Template = {
    ...template,
    ...changes,
    updatedAt: Date.now()
  };
  
  return await db.templateTable.put(updated, id);
};

// Delete template
export const deleteTemplate = async (id: number): Promise<void> => {
  await db.templateTable.delete(id);
};

// Get default templates (built-in templates)
export const getDefaultTemplates = async (): Promise<Template[]> => {
  // Returns built-in templates from /src/data/builtinTemplates.ts
  // with generated IDs and timestamps
};
```

#### Validation
- **Name**: Required, minimum length, unique per vault
- **Sort Order**: Non-negative integer
- **Fields**: Array of valid TemplateField objects
- **Icon**: Valid emoji or icon string

### File Table Module (`fileTable.ts`)
Handles operations on the `fileTable` which stores attached files in vaults.

#### Key Functions
```typescript
// Add file record
export const addFile = async (
  file: Omit<FileRecord, "id"> // id is provided (UUID)
): Promise<string> => {
  const now = Date.now();
  const fileWithTimestamps: FileRecord = {
    ...file,
    createdAt: now,
    updatedAt: now
  };
  await db.fileTable.add(fileWithTimestamps);
  return file.id; // Return the UUID
};

// Get file by ID
export const getFile = async (id: string): Promise<FileRecord | undefined> => {
  return await db.fileTable.get(id);
};

// Get files by vault ID
export const getFilesByVaultId = async (
  vaultId: string
): Promise<FileRecord[]> => {
  return await db.fileTable
    .where('vaultId')
    .equals(vaultId)
    .toArray();
};

// Get files by name (partial match)
export const getFilesByName = async (
  namePattern: string
): Promise<FileRecord[]> => {
  return await db.fileTable
    .filter(file => 
      file.name.toLowerCase().includes(namePattern.toLowerCase())
    )
    .toArray();
};

// Get files by MIME type
export const getFilesByMimeType = async (
  mimeType: string
): Promise<FileRecord[]> => {
  return await db.fileTable
    .where('mimeType')
    .equals(mimeType)
    .toArray();
};

// Update file
export const updateFile = async (
  id: string,
  changes: Partial<FileRecord>
): Promise<void> => {
  const file = await db.fileTable.get(id);
  if (!file) throw new Error(`File ${id} not found`);
  
  const updated: FileRecord = {
    ...file,
    ...changes,
    updatedAt: Date.now()
  };
  
  await db.fileTable.put(updated, id);
};

// Delete file
export const deleteFile = async (id: string): Promise<void> => {
  await db.fileTable.delete(id);
};

// Delete all files for a vault
export const deleteFilesByVaultId = async (
  vaultId: string
): Promise<void> => {
  await db.fileTable
    .where('vaultId')
    .equals(vaultId)
    .delete();
};

// Get storage usage by vault
export const getStorageUsageByVaultId = async (
  vaultId: string
): Promise<{ count: number; totalSize: number }> => {
  const files = await getFilesByVaultId(vaultId);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return {
    count: files.length,
    totalSize
  };
};
```

#### Validation
- **File Name**: Required, reasonable length limits
- **MIME Type**: Valid MIME type string
- **Size**: Non-negative integer, maximum size limits
- **Data**: Base64 encoded string (validated elsewhere)
- **Vault ID**: Must reference existing vault

## Cross-Table Operations

Some operations span multiple tables and are handled in the main fileStorage service:

### Vault Deletion Cascade
When deleting a vault:
```typescript
export const deleteVault = async (vaultId: string): Promise<void> => {
  await db.transaction('rw', db.vaultTable, db.accountTable, db.templateTable, db.fileTable, async () => {
    // Delete in dependency order
    await db.accountTable.where('vaultId').equals(vaultId).delete();
    await db.templateTable.where('vaultId').equals(vaultId).delete();
    await db.fileTable.where('vaultId').equals(vaultId).delete();
    await db.vaultTable.delete(vaultId);
  });
};
```

### Vault Cloning/Export
For creating vault copies or exports:
```typescript
export const cloneVault = async (
  sourceVaultId: string,
  newName: string
): Promise<string> => {
  return await db.transaction('rw', db.vaultTable, db.accountTable, db.templateTable, db.fileTable, async () => {
    // Get source vault
    const sourceVault = await db.vaultTable.get(sourceVaultId);
    if (!sourceVault) throw new Error('Source vault not found');
    
    // Create new vault
    const newVaultId = crypto.randomUUID();
    const now = Date.now();
    const newVault: KiyoVaultData = {
      id: newVaultId,
      name: newName,
      createdAt: now,
      updatedAt: now,
      accounts: [], // Will be populated below
      templates: [],
      files: [],
      settings: sourceVault.settings // Copy settings
    };
    
    await db.vaultTable.add(newVault);
    
    // Clone accounts
    const sourceAccounts = await db.accountTable
      .where('vaultId')
      .equals(sourceVaultId)
      .toArray();
    
    const accountPromises = sourceAccounts.map(account => {
      const { id, ...accountData } = account;
      return db.accountTable.add({
        ...accountData,
        vaultId: newVaultId,
        createdAt: now,
        updatedAt: now
      });
    });
    await Promise.all(accountPromises);
    
    // Clone templates (similar process)
    // Clone files (similar process)
    
    return newVaultId;
  });
};
```

## Index Usage Patterns

Each module leverages specific indexes for performance:

### Account Table Index Usage
- **getAccountsByVaultId**: Uses `vaultId` index (implicit primary key lookup)
- **getAccountsByDomain**: Uses explicit `domain` index
- **getFavoriteAccounts**: Uses `favorite` index
- **getAccountsByTag**: Uses `tag` index
- **Bulk operations**: Benefit from sorted inserts when possible

### Template Table Index Usage
- **getTemplatesByVaultId**: Uses `vaultId` index
- **getTemplatesSorted**: Uses `sortOrder` index for sorting
- **searchTemplatesByName**: Currently uses filter (could be enhanced with full-text search)

### File Table Index Usage
- **getFilesByVaultId**: Uses `vaultId` index
- **getFilesByName**: Uses filter on name (could add name index)
- **getFilesByMimeType**: Uses explicit `mimeType` index
- **getStorageUsageByVaultId**: Combines vaultId filter with aggregation

## Error Handling

### Common Error Types
- **NotFoundError**: When attempting to update/delete non-existent record
- **ConstraintError**: When violating uniqueness or other constraints
- **InvalidDataError**: When input fails validation
- **TransactionError**: When database transaction fails
- **QuotaExceededError**: When IndexedDB storage limit reached

### Error Handling Pattern
```typescript
try {
  // Database operation
  return await db.table.put(data);
} catch (error) {
  if (error.name === 'ConstraintError') {
    throw new Error(`Failed to save ${tableName}: ${error.message}`);
 

<tool_call>
<function=write_file>
<parameter=content>
---
type: overview
title: Hooks
description: Custom React hooks for state management, side effects, and platform-specific functionality.
tags: [hooks, react, zustand, persistence, auto-lock, clipboard, android]
---
# Hooks

KIYO uses custom React hooks to encapsulate reusable logic, manage side effects, and provide clean interfaces for components. These hooks integrate with Zustand stores, handle platform-specific features (like Android back button), and manage cross-cutting concerns such as persistence and security.

## Purpose

Custom hooks provide:
1. **Logic Reusability**: Encapsulate stateful logic for reuse across components
2. **Separation of Concerns**: Separate UI rendering from business logic and side effects
3. **Platform Integration**: Handle platform-specific features like Android back button
4. **State Synchronization**: Keep Zustand stores in sync with persistence layers
5. **Security Management**: Handle sensitive operations like auto-lock and clipboard clearing
6. **Performance Optimization**: Memoize expensive computations and prevent unnecessary re-renders

## Core Hooks

### Auto-Lock Hook (`useAutoLock.ts`)
Manages automatic vault locking based on user inactivity.

#### Purpose
- Automatically lock the vault after a period of inactivity
- Reset timer on user activity (touch, keypress, etc.)
- Provide remaining time to UI for countdown display
- Integrate with Android system locks and biometric re-auth

#### Implementation
```typescript
export const useAutoLock = () => {
  const { autoLockTimeout, remainingSeconds, isLocked } = useSettingsStore(
    state => state
  );
  
  // State for the hook
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  
  // Start/reset the auto-lock timer
  useEffect(() => {
    if (autoLockTimeout <= 0 || isLocked) {
      // Auto-lock disabled or already locked
      if (timeoutId) {
        clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      setIsCounting(false);
      return;
    }
    
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Set new timeout
    const id = setTimeout(() => {
      // Trigger vault lock
      useSessionStore.getState().logout();
      setIsCounting(false);
    }, autoLockTimeout * 60 * 1000); // Convert minutes to milliseconds
    
    setTimeoutId(id);
    setIsCounting(true);
    
    // Cleanup on unmount or dependency change
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [autoLockTimeout, isLocked]);
  
  // Handle user activity events
  useEffect(() => {
    if (autoLockTimeout <= 0 || !isCounting) return;
    
    const handleActivity = () => {
      // Reset the timer on user activity
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      const id = setTimeout(() => {
        useSessionStore.getState().logout();
        setIsCounting(false);
      }, autoLockTimeout * 60 * 1000);
      
      setTimeoutId(id);
    };
    
    // Listen for activity events
    ['touchstart', 'keydown', 'mousedown', 'focus'].forEach(event => {
      window.addEventListener(event, handleActivity);
    });
    
    return () => {
      ['touchstart', 'keydown', 'mousedown', 'focus'].forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [autoLockTimeout, isCounting, timeoutId]);
  
  // Format remaining time for display
  const formattedRemaining = useMemo(() => {
    if (!isCounting || remainingSeconds <= 0) return null;
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [isCounting, remainingSeconds]);
  
  return {
    remainingSeconds,
    formattedRemaining,
    isCounting,
    isLocked: autoLockTimeout > 0 && remainingSeconds <= 0
  };
};
```

#### Usage
- **Auth Page**: Starts timer after successful unlock
- **App Component**: Global activity listeners
- **Components**: Display remaining time with AutoLockIndicator
- **Settings**: Configure auto-lock timeout value

#### Testing
- **File**: `/src/hooks/useAutoLock.test.ts`
- **Tests**: Timer start/reset/cancel, activity detection, lock triggering

### File Auth Guard Hook (`useFileAuthGuard.ts`)
Protects routes that require an open vault session.

#### Purpose
- Redirect to auth page if no vault is open
- Allow access when vault is successfully opened
- Handle loading states during vault initialization
- Work with React Router for seamless navigation

#### Implementation
```typescript
export const useFileAuthGuard = () => {
  const { vault } = useSessionStore(state => state);
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!vault) {
      // No vault open, redirect to auth
      navigate('/auth', { replace: true });
    }
  }, [vault, navigate]);
  
  return { isAuthenticated: !!vault };
};
```

#### Usage
- **Account Pages**: Protect /accounts and subroutes
- **Template Pages**: Protect /templates and subroutes
- **Settings Page**: Protect access to vault settings
- **File Operations**: Protect import/export functionality

### Clipboard Hook (`useClipboard.ts`)
Provides secure clipboard operations with automatic clearing.

#### Purpose
- Copy text to clipboard securely
- Automatically clear clipboard after delay
- Handle clipboard errors gracefully
- Provide visual feedback for copy operations

#### Implementation
```typescript
export const useClipboard = () => {
  const { clipboardClearDelay } = useSettingsStore(
    state => state
  );
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      
      // Auto-clear after delay
      if (clipboardClearDelay > 0) {
        setTimeout(() => {
          navigator.clipboard.writeText(''); // Clear with empty string
          setCopied(false);
        }, clipboardClearDelay * 1000);
      }
      
      return true;
    } catch (err) {
      console.warn('Failed to copy text: ', err);
      setCopied(false);
      return false;
    }
  };
  
  const clearClipboard = async () => {
    try {
      await navigator.clipboard.writeText('');
      setCopied(false);
      return true;
    } catch (err) {
      console.warn('Failed to clear clipboard: ', err);
      return false;
    }
  };
  
  return { copyToClipboard, clearClipboard, copied };
};
```

#### Usage
- **Account Detail**: Copy username/password fields
- **Template Edit**: Copy field values
- **Settings**: Copy backup codes or keys
- **Anywhere**: Sensitive data that should not persist in clipboard

#### Security Features
- **Auto-Clear**: Configurable delay (default 30 seconds)
- **User Override**: Manual clear available
- **Error Handling**: Graceful degradation if clipboard API unavailable
- **Feedback**: Visual indication when copy succeeds

### Android Back Button Hook (`useAndroidBackButton.ts`)
Handle Android hardware back button for proper navigation vs app exit.

#### Purpose
- Intercept hardware back button on Android
- Navigate back in history when possible
- Exit app only when at root path
- Work with Capacitor and WebView on Android
- No-op on non-Android platforms

#### Implementation
```typescript
export const useAndroidBackButton = () => {
  const { isAndroid } = useDeviceStore();
  
  useEffect(() => {
    if (!isAndroid) return;
    
    const handleBackButton = () => {
      // Check if we can go back in history
      if (window.history.length > 1) {
        // Navigate back in React Router history
        window.history.back();
      } else {
        // At root, minimize app (Android back button behavior)
        // In Capacitor, this typically sends app to background
        Capacitor.App.exitApp();
      }
    };
    
    // Register back button listener
    Capacitor.App.addListener('backButton', handleBackButton);
    
    // Cleanup
    return () => {
      Capacitor.App.removeListener('backButton', handleBackButton);
    };
  }, [isAndroid]);
};
```

#### Usage
- **App.tsx**: Root level hook for global back button handling
- **No additional usage needed** - works application-wide

#### Platform Detection
- **Device Store**: `/src/store/deviceStore.ts` detects Android/iOS/web
- **Capacitor Platform**: Uses `@capacitor/core` to detect native platforms
- **User Agent Fallback**: For web environments

### Persistence Middleware (Conceptual)
While not a traditional hook, the persistence pattern used with Zustand stores follows hook-like principles.

#### Purpose
- Automatically sync Zustand store state with Dexie database
- Handle hydration on app start
- Manage persistence errors gracefully
- Provide selective persistence (which parts of state to persist)

#### Implementation Pattern
```typescript
// In store creation
export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      // ... state and actions
    }),
    {
      name: 'account-storage', // name of DB table
      storage: {
        getItem: async (name) => {
          const data = await db.settingsTable.get(1);
          return data ? JSON.parse(data.accounts) : null;
        },
        setItem: async (name, value) => {
          await db.settingsTable.update(1, { accounts: JSON.stringify(value) });
        },
        removeItem: async (name) => {
          await db.settingsTable.update(1, { accounts: null });
        }
      }
    }
  )
);
```

#### Usage
- **Account Store**: Persists account lists and metadata
- **Template Store**: Persists template definitions
- **Settings Store**: Persists user preferences
- **Session Store**: Not persisted (vault state is in memory only)

## Platform-Specific Hooks

### Web Share Hook (`useWebShare.ts`)
Handle Web Share API for sharing vault exports or account details.

#### Purpose
- Share data via native share sheet on supported platforms
- Fallback to copy-to-link or download on unsupported platforms
- Handle share errors gracefully

#### Implementation
```typescript
export const useWebShare = () => {
  const share = async (data: { title?: string; text?: string; url?: string }) => {
    if (navigator.share) {
      try {
        await navigator.share(data);
        return { success: true };
      } catch (err) {
        // Share cancelled or failed
        return { success: false, error: err };
      }
    } else {
      // Fallback: copy to clipboard or initiate download
      if (data.text) {
        await navigator.clipboard.writeText(data.text);
        return { success: true, fallback: 'copied' };
      }
      if (data.url) {
        // Initiate download
        const link = document.createElement('a');
        link.href = data.url;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return { success: true, fallback: 'downloaded' };
      }
      return { success: false, error: 'Web Share not available and no fallback data' };
    }
  };
  
  return { share };
};
```

### Biometric Hook (`useBiometric.ts`)
Wrapper for biometric authentication (fingerprint/face ID).

#### Purpose
- Abstract biometric auth across platforms
- Handle availability checking
- Manage error states and fallbacks
- Integrate with Android Keystore and iOS Keychain

#### Implementation
```typescript
export const useBiometric = () => {
  const [available, setAvailable] = useState(false);
  
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const result = await Capacitor.IsPluginAvailable('Biometric')
          ? (await Biometric.isAvailable())
          : false;
        setAvailable(result);
      } catch {
        setAvailable(false);
      }
    };
    
    checkAvailability();
  }, []);
  
  const authenticate = async (): Promise<boolean> => {
    if (!available) return false;
    
    try {
      const result = await Biometric.verify({
        reason: 'Confirm to unlock your vault'
      });
      return result.success;
    } catch (err) {
      console.error('Biometric auth failed:', err);
      return false;
    }
  };
  
  return { authenticate, available };
};
```

#### Usage
- **Auth Page**: Alternative to PIN unlock
- **Settings**: Enable/disable biometric unlock
- **Security**: Require biometric for sensitive operations

## Testing Patterns

### Hook Testing Library
- **React Hooks Test Library**: `@testing-library/react-hooks`
- **Mock Dependencies**: Jest mocks for browser/APIs
- **Async Testing**: Wait for state updates and effects
- **Event Simulation**: Dispatch events to test event handlers

### Test Files
- `/src/hooks/useAutoLock.test.ts`
- `/src/hooks/useClipboard.test.ts`
- `/src/hooks/useAndroidBackButton.test.ts`
- `/src/hooks/useBiometric.test.ts`

### Test Scenarios
- **State Changes**: Verify state updates correctly
- **Effect Cleanup**: Ensure subscriptions are cleaned up
- **Edge Cases**: Test with invalid inputs, missing APIs
- **Integration**: Test with stores and components
- **Performance**: Verify no memory leaks or excessive renders

## Source

### Primary Location
- `/src/hooks/` - All custom hook implementations

### Supporting Files
- `/src/store/` - Zustand stores that hooks interact with
- `/src/components/` - Components that use hooks (for integration testing)
- `/src/utils/` - Utility functions used by hooks
- `/src/plugins/` - Capacitor plugins used by platform-specific hooks

### Android Integration
- **Device Detection**: `/src/store/deviceStore.ts` uses Capacitor platform detection
- **Native Features**: Capacitor plugins bridge to Android/Java APIs
- **Web Fallbacks**: Hooks detect web environment and provide appropriate fallbacks

### iOS Considerations
- Currently hooks are Android-focused due to project scope
- Web fallbacks work on iOS Safari/WebView
- Native iOS would require additional Capacitor plugins

## Relationships

### Dependencies
- **React**: useState, useEffect, useContext, etc.
- **Zustand**: Store subscriptions and state updates
- **Capacitor**: Platform detection and native API access
- **Browser APIs**: Clipboard, history, Web Share, etc.
- **Utility Functions**: Formatters, validators, helpers from `/src/utils/`

### Dependents
- **Components**: UI components consume hook return values
- **Pages**: Page-level hooks for data fetching and state management
- **App**: Root-level hooks for global concerns (auto-lock, back button)
- **Stores**: Some hooks update store state (persistence middleware)
- **Tests**: Hook test files verify behavior in isolation

### Data Flow
```
User Action → Component Event → Hook Logic → 
  Store Update ←→ Persistence ←
  ↑                     ↓
Platform API (Android/Web) ← Native/Browser Bridges
```