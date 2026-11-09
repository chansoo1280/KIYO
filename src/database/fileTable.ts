import { db } from "@/database/db";
import { toBase64, fromBase64 } from "@/crypto/crypto.utils";
import { isEncryptedKiyoVaultData } from "@/crypto/encryption";
import type { KiyoVaultData } from "@/models/vault";
import type { EncryptedKiyoVaultData } from "@/crypto/encryption";

export interface FileRecord {
  id: string; // PK = fileName (v14)
  fileName: string;
  fileData: string; // JSON string of KiyoVaultData (encrypted or plain)
  encrypted: boolean;
  salt?: string;
  createdAt: number;
  updatedAt: number;
}

import { normalizeDataFileName } from "@/database/fileExport";

export type ActiveFileInfo =
  | { encrypted: true; fileData: EncryptedKiyoVaultData; salt: Uint8Array; activeFileName: string }
  | { encrypted: false; fileData: KiyoVaultData; salt: null; activeFileName: string }
  | { encrypted: false; fileData: null; salt: null; activeFileName: null };


export const fileTable = {
  /**
   * Update salt and updatedAt fields only (partial update) for a specific fileName
   */
  async updateFileRecord(fileName: string, salt?: Uint8Array): Promise<void> {
    const saltBase64 = salt ? toBase64(salt) : undefined;
    const now = Date.now();
    const updatedCount = await db.files
      .where("id")
      .equals(fileName)
      .modify({
        fileName,
        salt: saltBase64,
        updatedAt: now,
      });
    if (updatedCount === 0) {
      console.warn(
        `updateFileRecord: No existing file record found for "${fileName}", skipping update (salt-only mode)`,
      );
    }
  },

  /**
   * Get a single file record by fileName (fileName is the primary key in v14)
   */
  async getFileRecord(fileName: string): Promise<FileRecord | null> {
    const record = await db.files.get(fileName);
    return record ?? null;
  },

  /**
   * Get parsed file info (encrypted/plain, salt, fileData) for a specific fileName
   */
  async getFileInfo(fileName: string): Promise<ActiveFileInfo> {
    const fileRecord = await db.files.get(fileName);
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
   * Upsert file data (encrypted or plain) to files table.
   * In v14, the primary key is fileName itself, so each unique fileName
   * maps to a distinct row. createdAt is preserved on update.
   */
  async upsertFileRecord(
    fileName: string,
    fileData: KiyoVaultData | EncryptedKiyoVaultData,
  ): Promise<void> {
    const now = Date.now();

    const isEncrypted = isEncryptedKiyoVaultData(fileData);
    const existing = await db.files.get(fileName);
    const fileDataRecord: FileRecord = {
      id: fileName,
      fileName,
      fileData: JSON.stringify(fileData),
      encrypted: isEncrypted,
      salt: isEncrypted && "salt" in fileData ? fileData.salt : undefined,
      createdAt: existing?.createdAt ?? now,
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
   * Get all file records (used by Home file list)
   */
  async getAllFiles(): Promise<FileRecord[]> {
    return await db.files.toArray();
  },

  /**
   * Resolve a desired fileName to a unique name in the files table.
   * - Strip the `.json` extension.
   * - Detect a trailing `(N)` suffix on the base name; if present, use it as the starting counter.
   * - Otherwise, start from 1.
   * - Walk forward until a non-existing `<base><counter>.json` is found.
   *
   * Examples (assuming each previous candidate exists):
   *   my-accounts        → my-accounts(1).json
   *   my-accounts(1)     → my-accounts(2).json
   *   my-accounts(1)(1)  → my-accounts(1)(2).json  // unusual double-suffix, kept deterministic
   */
  async resolveFileName(desired: string): Promise<string> {
    const normalized = normalizeDataFileName(desired);
    const all = await db.files.toArray();
    const existing = new Set(all.map((r) => r.id));
    if (!existing.has(normalized)) return normalized;

    const base = normalized.replace(/\.json$/, "");
    const suffixMatch = base.match(/\((\d+)\)$/);
    const startCounter = suffixMatch ? Number(suffixMatch[1]) : 0;
    const stem = suffixMatch ? base.slice(0, -suffixMatch[0].length) : base;

    for (let i = startCounter + 1; ; i++) {
      const candidate = `${stem}(${i}).json`;
      if (!existing.has(candidate)) return candidate;
    }
  },

  /**
   * Delete a file record by fileName. Caller is responsible for active state;
   * we do not gate deletes on the row being active.
   */
  async deleteFileRecord(fileName: string): Promise<void> {
    await db.files.where("id").equals(fileName).delete();
  },
};
