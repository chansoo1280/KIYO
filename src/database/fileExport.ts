import { Capacitor } from "@capacitor/core";
import { KiyoFile } from "@/plugins/kiyofile";
import { FileStorageError, FileStorageErrorCode } from "@/errors/FileStorageError";
import type { KiyoVaultData } from "@/models/vault";
import type { EncryptedKiyoVaultData } from "@/crypto/encryption";

export const isNativeFileStorageAvailable = () => Capacitor.isNativePlatform();

export const normalizeDataFileName = (fileName: string) => {
  const trimmedName = fileName.trim() || "kiyo-data";
  return trimmedName.endsWith(".json") ? trimmedName : `${trimmedName}.json`;
};

/**
 * Export vault data as backup file via SAF (Android) or download (web)
 * This is for explicit user-initiated backup, NOT auto-save
 */
export const exportBackupFile = async (
  fileName: string,
  data: EncryptedKiyoVaultData | KiyoVaultData
): Promise<{ success: boolean; uri?: string }> => {
  if (!fileName) {
    console.error("exportBackupFile: fileName is empty");
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FORMAT,
      "fileName is empty",
      { operation: "exportBackupFile" },
    );
  }
  const normalizedFileName = normalizeDataFileName(fileName);

  if (!isNativeFileStorageAvailable()) {
    // Web fallback: download blob
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = normalizedFileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return { success: true, uri: `blob:${normalizedFileName}` };
  }

  try {
    const result = await KiyoFile.saveFile({
      fileName: normalizedFileName,
      mimeType: "application/json",
      data: JSON.stringify(data, null, 2),
    });

    if (!result.success) {
      throw FileStorageError.create(
        FileStorageErrorCode.WRITE_FAILED,
        result.cancelled ? "User cancelled backup" : "Failed to save backup file",
        { operation: "exportBackupFile", fileName: normalizedFileName },
      );
    }

    return { success: true, uri: result.uri };
  } catch (error) {
    if (error instanceof FileStorageError) throw error;
    console.error("exportBackupFile: saveFile failed", error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : "");
    throw FileStorageError.create(
      FileStorageErrorCode.WRITE_FAILED,
      "Failed to write backup file",
      {
        originalError: error instanceof Error ? error : undefined,
        fileName: normalizedFileName,
        operation: "exportBackupFile",
      },
    );
  }
};

/**
 * Import vault data from backup file via SAF (Android) or file picker (web)
 */
// export const importBackupFile = async (): Promise<{
//   success: boolean;
//   data?: string;
//   uri?: string;
// }> => {
//   if (!isNativeFileStorageAvailable()) {
//     // Web: cannot programmatically open file picker from here
//     // Caller should use <input type="file"> and pass data directly
//     throw FileStorageError.create(
//       FileStorageErrorCode.FILE_READ_FAILED,
//       "Web import requires file input element",
//       { operation: "importBackupFile" },
//     );
//   }

//   try {
//     const result = await KiyoFile.openFile({
//       mimeType: "application/json",
//     });

//     if (!result.success) {
//       return { success: false, uri: result.uri };
//     }

//     return { success: true, data: result.data, uri: result.uri };
//   } catch (error) {
//     console.error("importBackupFile: openFile failed", error instanceof Error ? error.message : String(error));
//     throw FileStorageError.create(
//       FileStorageErrorCode.FILE_READ_FAILED,
//       "Failed to open backup file",
//       {
//         originalError: error instanceof Error ? error : undefined,
//         operation: "importBackupFile",
//       },
//     );
//   }
// };

/**
 * Write to existing SAF URI (for auto-backup)
 */
export const writeBackupToUri = async (
  uri: string,
  data: EncryptedKiyoVaultData | KiyoVaultData
): Promise<{ success: boolean; errorCode?: string; errorMessage?: string }> => {
  if (!isNativeFileStorageAvailable()) {
    // Web: no persistent URI support
    return { success: false, errorCode: "WEB_UNSUPPORTED", errorMessage: "Persistent URI not available on web" };
  }

  try {
    const result = await KiyoFile.writeToUri({
      uri,
      data: JSON.stringify(data, null, 2),
    });
    return {
      success: result.success,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    };
  } catch (error) {
    console.error("writeBackupToUri failed", error instanceof Error ? error.message : String(error));
    return { success: false, errorCode: "EXCEPTION", errorMessage: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Read from existing SAF URI
 */
export const readBackupFromUri = async (uri: string): Promise<string | null> => {
  if (!isNativeFileStorageAvailable()) {
    return null;
  }

  try {
    const result = await KiyoFile.readFromUri({ uri });
    return result.success ? result.data : null;
  } catch (error) {
    console.error("readBackupFromUri failed", error instanceof Error ? error.message : String(error));
    return null;
  }
};

/**
 * Pick backup folder via SAF (for auto-backup setup)
 */
export const pickBackupFolder = async (): Promise<{ success: boolean; uri?: string }> => {
  if (!isNativeFileStorageAvailable()) {
    return { success: false };
  }

  try {
    const result = await KiyoFile.pickBackupFolder();
    if (result.cancelled) {
      return { success: false };
    }
    return { success: result.success, uri: result.uri };
  } catch (error) {
    console.error("pickBackupFolder failed", error instanceof Error ? error.message : String(error));
    return { success: false };
  }
};