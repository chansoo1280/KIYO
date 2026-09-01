---
type: android-component
title: KiyoFilePlugin
description: Capacitor plugin for vault backup file operations (SAF save/open, URI read/write, folder pick).
tags: [android, capacitor, file, saf, backup]
---

# KiyoFilePlugin

`/android/app/src/main/java/com/kiyo/app/capacitor/KiyoFilePlugin.kt` is the native implementation of the `KiyoFile` Capacitor plugin (declared at `/src/plugins/kiyofile.ts`).

## Plugin Shape

```kotlin
@CapacitorPlugin(name = "KiyoFile")
class KiyoFilePlugin : Plugin() {
    // ...
}
```

## Methods

### saveFile

```kotlin
@PluginMethod
fun saveFile(call: PluginCall) {
    val fileName = call.getString("fileName") ?: return call.reject("fileName required")
    val mimeType = call.getString("mimeType") ?: "application/octet-stream"
    val data = call.getString("data") ?: return call.reject("data required")
    GlobalScope.launch(Dispatchers.IO) {
        try {
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = mimeType
                putExtra(Intent.EXTRA_TITLE, fileName)
            }
            // ...
        } catch (e: Exception) { call.reject(e.message, e) }
    }
}
```

Launches SAF's `ACTION_CREATE_DOCUMENT` to let the user pick a destination folder + filename, then writes the data via the returned `content://` URI. Returns `{success: true, uri}` on success or `{success: false, cancelled: true}` if the user cancelled the picker.

### openFile

```kotlin
@PluginMethod
fun openFile(call: PluginCall) { /* ACTION_OPEN_DOCUMENT with mimeType */ }
```

Launches SAF's `ACTION_OPEN_DOCUMENT` and reads the selected file. Returns `{success: true, data, uri}` with the file contents as a string.

### writeToUri / readFromUri

```kotlin
@PluginMethod
fun writeToUri(call: PluginCall) { /* writes to an existing URI */ }
@PluginMethod
fun readFromUri(call: PluginCall) { /* reads from an existing URI */ }
```

Used by the auto-backup feature (`fileExport.writeBackupToUri`, `readBackupFromUri`). The URI is a `content://` URI obtained once during `pickBackupFolder` and persisted in `settingsStore.autoBackupUri`.

### pickBackupFolder

```kotlin
@PluginMethod
fun pickBackupFolder(call: PluginCall) { /* ACTION_OPEN_DOCUMENT_TREE */ }
```

Launches SAF's `ACTION_OPEN_DOCUMENT_TREE` to let the user pick a folder; the returned `content://` URI becomes the auto-backup target.

## Permission Errors

```kotlin
if (result.errorCode == "PERMISSION_REVOKED") {
    // Persisted URI permission was revoked by the user
}
```

When the persisted URI permission is revoked (e.g., the user deleted the auto-backup folder or the app was reinstalled), the plugin returns the `PERMISSION_REVOKED` error code. The React side (`db.tryTriggerAutoBackup`) reacts by disabling auto-backup.

## Source Anchors

- `KiyoFilePlugin.kt` — `/android/app/src/main/java/com/kiyo/app/capacitor/KiyoFilePlugin.kt`
- Web stub — `/src/plugins/kiyofile.ts`, `/src/plugins/kiyofile.web.ts`
- Web consumer — `/src/database/fileExport.ts` (`exportBackupFile`, `importBackupFile`, `writeBackupToUri`, `readBackupFromUri`, `pickBackupFolder`)
- FileProvider — `/android/app/src/main/AndroidManifest.xml` (`androidx.core.content.FileProvider`)