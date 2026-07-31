import { db } from "@/database/db";
import { toBase64, fromBase64 } from "@/crypto/crypto.utils";
import { isEncryptedKiyoFile } from "@/crypto/encryption";
import type { KiyoDataFile } from "@/database/fileStorage";
import type { EncryptedKiyoFile } from "@/crypto/encryption";
import type { FileData } from "@/database/db";

interface ActiveFileInfo {
  activeFileName: string | null;
  salt: Uint8Array | null;
  encrypted: boolean;
  fileData: KiyoDataFile | EncryptedKiyoFile | null;
}

export const fileTable = {
  /**
   * Save active file info to files table (update salt only, don't touch other fields)
   */
  async saveActiveFileInfo(fileName: string, salt?: Uint8Array): Promise<void> {
    const saltBase64 = salt ? toBase64(salt) : undefined;
    const now = Date.now();
    // Update only salt and updatedAt fields, don't touch other fields
    const updatedCount = await db.files
      .where("fileName")
      .equals(fileName)
      .modify({
        salt: saltBase64,
        updatedAt: now,
      });
    if (updatedCount === 0) {
      console.warn(
        `saveActiveFileInfo: No existing file record found for "${fileName}", skipping update (salt-only mode)`,
      );
    }
  },

  /**
   * Get active file info from files table
   */
  async getActiveFileInfo(): Promise<ActiveFileInfo> {
    // Get fileRecord from DB to check for salt as fallback
    const fileRecord = await db.files.orderBy("updatedAt").reverse().first();
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
      fileData: JSON.parse(fileRecord.fileData),
      encrypted: fileRecord.encrypted,
    };
  },

  /**
   * Save file data (encrypted or plain) to files table
   * Determines encryption status from the data itself (EncryptedKiyoFile has encrypted: true)
   */
  async saveFileDataToDB(
    fileName: string,
    fileData: KiyoDataFile | EncryptedKiyoFile,
    salt?: Uint8Array,
  ): Promise<void> {
    await db.files.clear();
    const now = Date.now();

    // Check if the data itself is encrypted (EncryptedKiyoFile has encrypted: true property)
    const isEncrypted = isEncryptedKiyoFile(fileData);

    const fileDataRecord: FileData = {
      id: Date.now(), // Assign a unique ID
      fileName,
      fileData: JSON.stringify(fileData),
      encrypted: isEncrypted,
      salt: isEncrypted && salt ? toBase64(salt) : undefined,
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
   * Clear active file info from files table
   */
  async clearActiveFileInfo(fileName?: string): Promise<void> {
    if (fileName) {
      await db.files.where("fileName").equals(fileName).delete();
    } else {
      await db.files.clear();
    }
  },
};