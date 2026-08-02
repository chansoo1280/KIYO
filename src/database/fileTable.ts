import { db } from "@/database/db";
import { toBase64, fromBase64 } from "@/crypto/crypto.utils";
import { isEncryptedKiyoVaultData as isEncryptedKiyoFile } from "@/crypto/encryption";
import type { KiyoVaultData } from "@/models/vault";
import type { EncryptedKiyoVaultData } from "@/crypto/encryption";
import type { FileRecord } from "@/database/db";

export const ACTIVE_FILE_ID = "active" as const;

export function parseFileData(rawData: string): KiyoVaultData | EncryptedKiyoVaultData {
  const parsed = JSON.parse(rawData);

  if (isEncryptedKiyoFile(parsed)) {
    return parsed;
  }

  return parsed as KiyoVaultData;
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
  async getActiveFileInfo(): Promise<{
    activeFileName: string | null;
    salt: Uint8Array | null;
    encrypted: boolean;
    fileData: KiyoVaultData | EncryptedKiyoVaultData | null;
  }> {
    const fileRecord = await db.files.get(ACTIVE_FILE_ID);
    if (!fileRecord) {
      return {
        activeFileName: null,
        salt: null,
        encrypted: false,
        fileData: null,
      };
    }
    return {
      activeFileName: fileRecord.fileName,
      salt: fileRecord.salt ? fromBase64(fileRecord.salt) : null,
      fileData: parseFileData(fileRecord.fileData),
      encrypted: fileRecord.encrypted,
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

    const isEncrypted = isEncryptedKiyoFile(fileData);
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
   * Delete active file record from files table
   */
  async deleteFileRecord(): Promise<void> {
    await db.files.where("id").equals(ACTIVE_FILE_ID).delete();
  },
};