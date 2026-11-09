package com.kiyo.app.capacitor

import android.app.Activity
import android.content.ContentResolver
import android.content.Intent
import android.database.DatabaseUtils
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.io.OutputStream

@CapacitorPlugin(name = "KiyoFile")
class KiyoFilePlugin : Plugin() {

    companion object {
        private const val TAG = "KiyoFilePlugin"
        private const val MIME_TYPE = "application/json"
    }

    private var pendingSaveCall: PluginCall? = null
    private var pendingOpenCall: PluginCall? = null
    private var pendingPickFolderCall: PluginCall? = null

    private lateinit var createDocumentLauncher: ActivityResultLauncher<String>
    private lateinit var openDocumentLauncher: ActivityResultLauncher<Array<String>>
    private lateinit var openDocumentTreeLauncher: ActivityResultLauncher<Uri?>

    override fun load() {
        super.load()
        val activity = getActivity() ?: return
        val fragmentActivity = activity as FragmentActivity

        createDocumentLauncher = fragmentActivity.registerForActivityResult(
            ActivityResultContracts.CreateDocument()
        ) { uri: Uri? ->
            handleCreateDocumentResult(uri)
        }

        openDocumentLauncher = fragmentActivity.registerForActivityResult(
            ActivityResultContracts.OpenDocument()
        ) { uri: Uri? ->
            handleOpenDocumentResult(uri)
        }

        openDocumentTreeLauncher = fragmentActivity.registerForActivityResult(
            ActivityResultContracts.OpenDocumentTree()
        ) { uri: Uri? ->
            handlePickBackupFolderResult(uri)
        }
    }

    @PluginMethod
    fun saveFile(call: PluginCall) {
        val fileName = call.getString("fileName") ?: "kiyo-backup.json"

        // Store call for callback after user picks location
        pendingSaveCall = call

        // Ensure we have context
        val context = getContext() ?: return call.reject("Context is null")

        // Check if running on Android 19+ (API 19+)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
            pendingSaveCall = null
            call.reject("SAF requires Android 4.4 (API 19) or higher")
            return
        }

        try {
            // Launch with file name - CreateDocument adds it as EXTRA_TITLE
            createDocumentLauncher.launch(fileName)
        } catch (e: Exception) {
            pendingSaveCall = null
            Log.e(TAG, "Error starting save file activity", e)
            call.reject("Failed to start file save: ${e.message}")
        }
    }

    @PluginMethod
    fun openFile(call: PluginCall) {
        pendingOpenCall = call

        val context = getContext() ?: return call.reject("Context is null")

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
            pendingOpenCall = null
            call.reject("SAF requires Android 4.4 (API 19) or higher")
            return
        }

        try {
            // Launch with MIME type filter
            openDocumentLauncher.launch(arrayOf(MIME_TYPE))
        } catch (e: Exception) {
            pendingOpenCall = null
            Log.e(TAG, "Error starting open file activity", e)
            call.reject("Failed to open file: ${e.message}")
        }
    }

    @PluginMethod
    fun pickBackupFolder(call: PluginCall) {
        pendingPickFolderCall = call

        val context = getContext() ?: return call.reject("Context is null")

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
            pendingPickFolderCall = null
            call.reject("SAF requires Android 4.4 (API 19) or higher")
            return
        }

        try {
            openDocumentTreeLauncher.launch(null)
        } catch (e: Exception) {
            pendingPickFolderCall = null
            Log.e(TAG, "Error starting pick folder activity", e)
            call.reject("Failed to pick folder: ${e.message}")
        }
    }

    private fun handlePickBackupFolderResult(uri: Uri?) {
        val call = pendingPickFolderCall ?: return
        pendingPickFolderCall = null

        if (uri == null) {
            call.resolve(JSObject().apply {
                put("success", false)
                put("cancelled", true)
            })
            return
        }

        val context = getContext() ?: return call.reject("Context is null")

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val contentResolver: ContentResolver = context.contentResolver

                // Persist URI permission for future writes (auto-backup)
                val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                try {
                    contentResolver.takePersistableUriPermission(uri, takeFlags)
                    Log.d(TAG, "Persisted URI permission for backup folder: $uri")
                } catch (e: SecurityException) {
                    Log.w(TAG, "Could not persist URI permission: ${e.message}")
                }

                call.resolve(JSObject().apply {
                    put("success", true)
                    put("uri", uri.toString())
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error picking backup folder", e)
                call.reject("Failed to pick backup folder: ${e.message}")
            }
        }
    }

    private fun handleCreateDocumentResult(uri: Uri?) {
        val call = pendingSaveCall ?: return
        pendingSaveCall = null

        if (uri == null) {
            call.resolve(JSObject().apply {
                put("success", false)
                put("cancelled", true)
            })
            return
        }

        val context = getContext() ?: return call.reject("Context is null")

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val outputString = call.getString("data") ?: ""
                val contentResolver: ContentResolver = context.contentResolver

                // Write to the URI
                contentResolver.openOutputStream(uri)?.use { outputStream: OutputStream ->
                    outputStream.write(outputString.toByteArray())
                }

                // Persist URI permission for future writes (auto-backup)
                val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                try {
                    contentResolver.takePersistableUriPermission(uri, takeFlags)
                    Log.d(TAG, "Persisted URI permission for: $uri")
                } catch (e: SecurityException) {
                    Log.w(TAG, "Could not persist URI permission: ${e.message}")
                }

                call.resolve(JSObject().apply {
                    put("success", true)
                    put("uri", uri.toString())
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error saving file", e)
                call.reject("Failed to save file: ${e.message}")
            }
        }
    }

    private fun handleOpenDocumentResult(uri: Uri?) {
        val call = pendingOpenCall ?: return
        pendingOpenCall = null

        if (uri == null) {
            call.resolve(JSObject().apply {
                put("success", false)
                put("cancelled", true)
            })
            return
        }

        val context = getContext() ?: return call.reject("Context is null")

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val contentResolver: ContentResolver = context.contentResolver

                // Read from the URI
                val inputStream = contentResolver.openInputStream(uri)
                val outputStream = ByteArrayOutputStream()
                inputStream?.use { input ->
                    input.copyTo(outputStream)
                }
                val fileContent = outputStream.toString("UTF-8")

                // Persist URI permission
                val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                try {
                    contentResolver.takePersistableUriPermission(uri, takeFlags)
                } catch (e: SecurityException) {
                    Log.w(TAG, "Could not persist URI permission: ${e.message}")
                }

                call.resolve(JSObject().apply {
                    put("success", true)
                    put("uri", uri.toString())
                    put("data", fileContent)
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error opening file", e)
                call.reject("Failed to open file: ${e.message}")
            }
        }
    }

    @PluginMethod
        fun writeToUri(call: PluginCall) {
            val uriString = call.getString("uri") ?: return call.reject("URI is required")
            val data = call.getString("data") ?: return call.reject("Data is required")

            val uri = Uri.parse(uriString)
            val context = getContext() ?: return call.reject("Context is null")

            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val contentResolver: ContentResolver = context.contentResolver

                    // Check if URI is a tree/document URI (directory) - need to find/create file inside
                    val targetUri: Uri
                    if (DocumentsContract.isTreeUri(uri)) {
                        // For auto-backup: find existing file or create new one with fixed name
                        val displayName = "kiyo-autobackup-latest.json"
                        val mimeType = "application/json"

                        // Get the document URI for the tree root (selected folder)
                        val treeDocId = DocumentsContract.getTreeDocumentId(uri)
                        val parentDocUri = DocumentsContract.buildDocumentUriUsingTree(uri, treeDocId)

                        // Query for existing document in the tree
                        val projection = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                        val selection = "${DocumentsContract.Document.COLUMN_DISPLAY_NAME} = ? AND ${DocumentsContract.Document.COLUMN_MIME_TYPE} = ?"
                        val selectionArgs = arrayOf(displayName, mimeType)

                        val childUri = DocumentsContract.buildChildDocumentsUriUsingTree(uri, treeDocId)
                        val existingDocId = contentResolver.query(
                            childUri,
                            projection,
                            selection,
                            selectionArgs,
                            null
                        )?.use { cursor ->
                            if (cursor.moveToFirst()) cursor.getString(0) else null
                        }

                        val existingUri = existingDocId?.let { DocumentsContract.buildDocumentUriUsingTree(uri, it) }
                        val createdUri = existingUri ?: DocumentsContract.createDocument(contentResolver, parentDocUri, mimeType, displayName)

                        if (createdUri == null) {
                            call.reject("Failed to create document in backup folder")
                            return@launch
                        }
                        targetUri = createdUri
                    } else {
                        targetUri = uri
                    }

                    contentResolver.openOutputStream(targetUri)?.use { outputStream: OutputStream ->
                        outputStream.write(data.toByteArray())
                    }

                    call.resolve(JSObject().apply {
                        put("success", true)
                    })
                } catch (e: SecurityException) {
                    Log.e(TAG, "SecurityException writing to URI - permission may be revoked", e)
                    call.resolve(JSObject().apply {
                        put("success", false)
                        put("errorCode", "PERMISSION_REVOKED")
                        put("errorMessage", e.message)
                    })
                } catch (e: Exception) {
                    Log.e(TAG, "Error writing to URI", e)
                    call.resolve(JSObject().apply {
                        put("success", false)
                        put("errorCode", "WRITE_FAILED")
                        put("errorMessage", e.message)
                    })
                }
            }
        }

    @PluginMethod
    fun readFromUri(call: PluginCall) {
        val uriString = call.getString("uri") ?: return call.reject("URI is required")

        val uri = Uri.parse(uriString)
        val context = getContext() ?: return call.reject("Context is null")

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val contentResolver: ContentResolver = context.contentResolver
                val inputStream = contentResolver.openInputStream(uri)
                val outputStream = ByteArrayOutputStream()
                inputStream?.use { input ->
                    input.copyTo(outputStream)
                }
                val fileContent = outputStream.toString("UTF-8")

                call.resolve(JSObject().apply {
                    put("success", true)
                    put("data", fileContent)
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error reading from URI", e)
                call.reject("Failed to read from URI: ${e.message}")
            }
        }
    }
}