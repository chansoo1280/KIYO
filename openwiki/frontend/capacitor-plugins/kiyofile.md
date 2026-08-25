---
type: capacitor-plugin
title: KiyoFile Capacitor Plugin
description: Capacitor plugin for file system operations (save, open, read, write) with web fallbacks for vault import/export functionality.
tags: [frontend, capacitor-plugin, file-system, kiyofile]
---
# KiyoFile Capacitor Plugin (`src/plugins/kiyofile.ts` and `kiyofile.web.ts`)

The KiyoFile plugin provides Capacitor-based file system operations for importing and exporting encrypted vault files. It implements a native bridge with web fallbacks for development and testing.

## Interface Definition

The plugin defines several interfaces for file operations:

### `SaveFileResult`
- `success`: boolean indicating operation success
- `uri`: string representing the file URI (web: blob URL)
- `cancelled`: boolean indicating if user cancelled the operation

### `OpenFileResult`
- `success`: boolean indicating operation success
- `uri`: string representing the selected file URI
- `data`: string containing the file contents
- `cancelled`: boolean indicating if user cancelled the operation

### `WriteToUriResult`
- `success`: boolean indicating operation success

### `ReadFromUriResult`
- `success`: boolean indicating operation success
- `data`: string containing the file contents

### `KiyoFilePlugin`
Defines the plugin methods:
- `saveFile(options)`: Save data to a file
- `openFile(options)`: Open file picker to read a file
- `writeToUri(options)`: Write data to a specific URI
- `readFromUri(options)`: Read data from a specific URI

## Plugin Registration

```typescript
const KiyoFile = registerPlugin<KiyoFilePlugin>("KiyoFile", {
  web: () => import("./kiyofile.web").then((m) => new m.KiyoFileWeb()),
});
```

The plugin registers with Capacitor and provides a web fallback implementation.

## Web Fallback Implementation (`kiyofile.web.ts`)

The web implementation provides fallback behavior for browser environments:

### `saveFile(options)`
- Creates a Blob from the data
- Generates an object URL
- Creates and clicks a download anchor
- Returns success with blob URI

### `openFile()`
- Not available on web (requires file picker API)
- Returns failure with warning

### `writeToUri()`
- Not available on web
- Returns failure with warning

### `readFromUri()`
- Not available on web
- Returns failure with warning

## Usage Examples

### Saving a Vault File
```typescript
import { KiyoFile } from '@/plugins/kiyofile';

async function exportVault(vaultData: string) {
  const result = await KiyoFile.saveFile({
    fileName: 'my-vault.kiyo',
    mimeType: 'application/octet-stream',
    data: vaultData
  });
  
  if (result.success && !result.cancelled) {
    console.log('Vault exported to:', result.uri);
  }
}
```

### Opening a Vault File
```typescript
async function importVault() {
  const result = await KiyoFile.openFile({
    mimeType: 'application/octet-stream'
  });
  
  if (result.success && !result.cancelled && result.data) {
    // Process imported vault data
    return result.data;
  }
}
```

## Android Implementation

The actual Android implementation resides in the native Android code (`/android/app/src/main/java/com/kiyo/app/plugins/KiyoFile.java` or Kotlin equivalent) which handles real file system operations using Android's Storage Access Framework or similar APIs.

## Integration with Vault Operations

This plugin is used by:
- Vault import/export functionality in the settings
- Backup and restore operations
- File-based vault management

## Testing

Web fallback behavior can be tested in browser environments. Native functionality requires Android device/emulator testing.

## Related Files

- Plugin definition: `/src/plugins/kiyofile.ts`
- Web fallback: `/src/plugins/kiyofile.web.ts`
- Android native implementation: (located in android source)
- Usage in settings: `/src/pages/Settings/` components
- Vault encryption: `/openwiki/frontend/crypto/vault-encryption.md`