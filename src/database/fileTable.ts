import { db } from "@/database/db";
import { toBase64, fromBase64 } from "@/crypto/crypto.utils";
import { isEncryptedKiyoVaultData } from "@/crypto/encryption";
import type { KiyoVaultData } from "@/models/vault";
import type { EncryptedKiyoVaultData } from "@/crypto/encryption";
import type { FileRecord } from "@/database/db";

export const ACTIVE_FILE_ID = "active" as const;


export type ActiveFileInfo =
  | { encrypted: true; fileData: EncryptedKiyoVaultData; salt: Uint8Array; activeFileName: string }
  | { encrypted: false; fileData: KiyoVaultData; salt: null; activeFileName: string }
  | { encrypted: false; fileData: null; salt: null; activeFileName: null };


export const parseFileData = (json: string): any => {
  return JSON.parse(json);
}
export const fileTable = {
  /**
   * Update salt and updatedAt fields only (partial update)
   */
  async updateFileRecord(fileName: string, salt?: Uint8Array): Promise<void> {
    const saltBase64 = salt ? toBase64(salt) : undefined;
    const now = Date.now();
    const updatedCount = await db.files
      .where("id")
      .equals(ACTIVE_FILE_ID)
      .modify({
        fileName,
        salt: saltBase64,
        updatedAt: now,
      });
    if (updatedCount === 0) {
      console.warn(
        `updateFileRecord: No existing file record found for "${ACTIVE_FILE_ID}", skipping update (salt-only mode)`,
      );
    }
  },

  /**
   * Get active file record from files table (returns raw FileRecord)
   */
  async getActiveFileRecord(): Promise<FileRecord | null> {
    const record = await db.files.get(ACTIVE_FILE_ID);
    return record ?? null;
  },

  /**
   * Get active file info with parsed data
   */
  async getActiveFileInfo(): Promise<ActiveFileInfo> {
    const fileRecord = await db.files.get(ACTIVE_FILE_ID);
    if (!fileRecord) {
      return {
        activeFileName: null,
        salt: null,
        encrypted: false,
        fileData: null,
      };
    }
    const parsedData = JSON.parse(fileRecord.fileData);
    const isEncrypted = isEncryptedKiyoVaultData(parsedData);
    if (isEncrypted) {
      return {
        activeFileName: fileRecord.fileName,
        salt: fromBase64(fileRecord.salt!),
        fileData: parsedData,
        encrypted: true,
      };
    }
    return {
      activeFileName: fileRecord.fileName,
      salt: null,
      fileData: parsedData,
      encrypted: false,
    };
  },

  /**
   * Upsert file data (encrypted or plain) to files table
   * Determines encryption status from the data itself (EncryptedKiyoFile has encrypted: true)
   */
  async upsertFileRecord(
    fileName: string,
    fileData: KiyoVaultData | EncryptedKiyoVaultData,
  ): Promise<void> {
    const now = Date.now();

    const isEncrypted = isEncryptedKiyoVaultData(fileData);
    const fileDataRecord: FileRecord = {
      id: ACTIVE_FILE_ID,
      fileName,
      fileData: JSON.stringify(fileData),
      encrypted: isEncrypted,
      salt: isEncrypted && "salt" in fileData ? fileData.salt : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await db.files.put(fileDataRecord);
  },

  /**
     * Get all file names from files table
     */
    async getAllFileNames(): Promise<string[]> {
      const files = await db.files.toArray();
      return files.map((f) => f.fileName);
    },

    /**
     * Get file record by fileName
     */

  /**
   * Delete active file record from files table
   */
  async deleteFileRecord(): Promise<void> {
    await db.files.where("id").equals(ACTIVE_FILE_ID).delete();
  },
};