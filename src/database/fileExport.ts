import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { FileStorageError, FileStorageErrorCode } from "@/errors/FileStorageError";
import type { KiyoVaultData } from "@/models/vault";
import type { EncryptedKiyoVaultData } from "@/crypto/encryption";
import { isNativeFileStorageAvailable, normalizeDataFileName } from "./fileStorage";

/**
 * Export vault data to filesystem
 */
export const exportVaultFile = async (
  fileName: string,
  data: EncryptedKiyoVaultData | KiyoVaultData
): Promise<void> => {
  if (!fileName) {
    console.error("exportVaultFile: fileName is empty");
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FORMAT,
      "fileName is empty",
      { operation: "exportVaultFile" },
    );
  }
  const normalizedFileName = normalizeDataFileName(fileName);
  if (!isNativeFileStorageAvailable()) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = normalizedFileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  try {
    await Filesystem.writeFile({
      path: normalizedFileName,
      data: JSON.stringify(data, null, 2),
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  } catch (error) {
    console.error("exportVaultFile: Filesystem.writeFile failed", error);
    throw FileStorageError.create(
      FileStorageErrorCode.WRITE_FAILED,
      "Failed to write file",
      {
        originalError: error instanceof Error ? error : undefined,
        fileName: normalizedFileName,
        operation: "exportVaultFile",
      },
    );
  }
};