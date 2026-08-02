import { Capacitor } from "@capacitor/core";
import Dexie, { type EntityTable, type Table } from "dexie";
import { encryptData, type EncryptedKiyoVaultData } from "@/crypto/encryption";
import type { KiyoVaultData } from "@/models/vault";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import type {
  AppSettings,
  FileMetadata,
} from "@/models/account";
import { isFileStorageError } from "@/errors/FileStorageError";
import { fileTable, ACTIVE_FILE_ID } from "@/database/fileTable";
import type { AccountRecord } from "@/database/accountTable";
import type { TemplateRecord } from "@/database/templateTable";
import { exportVaultFile } from "@/database/fileExport";

export interface FileRecord {
  id: typeof ACTIVE_FILE_ID;
  fileName: string;
  fileData: string; // JSON string of KiyoVaultData (encrypted or plain)
  encrypted: boolean;
  salt?: string;
  createdAt: number;
  updatedAt: number;
}

export class KiyoDatabase extends Dexie {
  accounts!: EntityTable<AccountRecord, "id">;
  templates!: EntityTable<TemplateRecord, "id">;
  settings!: Table<AppSettings, number>;
  metadata!: Table<FileMetadata, number>;
  files!: Table<FileRecord, typeof ACTIVE_FILE_ID>;

  constructor() {
    super("kiyo-db");
    this.version(13)
      .stores({
        accounts:
          "++id, createdAt, updatedAt",
        templates:
          "++id, createdAt, updatedAt",
        settings:
          "++id, theme, lockEnabled, autoLockTime, fontSize, biometricEnabled",
        metadata: "id, version, createdAt",
        files: "id, fileName, createdAt, updatedAt",
      })
      .upgrade((transaction) => {
        // v12: files 테이블 키를 ++id에서 고정 "active"로 변경
        // 기존 레코드 삭제 후 새로 생성 (볼트 파일로 복원 가능하므로 데이터 손실 없음)
        transaction.table("files").clear();
      });
  }
}

export const db = new KiyoDatabase();

export const getDatabaseSnapshot = async (
  filename: string,
  cryptoKey?: CryptoKey,
): Promise<KiyoVaultData> => {
  const [accounts, templates] = await Promise.all([
    accountTable.getAll(cryptoKey),
    templateTable.getAll(cryptoKey),
  ]);

  return {
    version: 1,
    fileName: filename || "kiyo-data.json",
    updatedAt: Date.now(),
    accounts,
    templates,
    metadata: await db.metadata.toArray(),
    // Note: files table is intentionally excluded from JSON export
    // Note: settings table is intentionally excluded from JSON export
  };
};

export interface SyncDatabaseParams {
  activeFileName: string | null;
  cryptoKey: CryptoKey | null;
  salt: Uint8Array | null;
  clearSyncError?: () => void;
  setSyncError?: (error: string) => void;
}

export const syncDatabaseToFile = async (params: SyncDatabaseParams): Promise<void> => {
  const { activeFileName, cryptoKey, salt, clearSyncError, setSyncError } = params;

  try {
    if (!activeFileName) {
      console.warn("syncDatabaseToFile: No active file name");
      return;
    }
    if (!isNativeFileStorageAvailable()) {
      // 앱에서만 자동저장
      return;
    }
    const data = await getDatabaseSnapshot(activeFileName, cryptoKey ?? undefined);
    
    // Also write to filesystem
    if (!cryptoKey || !salt) {
      await fileTable.upsertFileRecord(activeFileName, data);
      await exportVaultFile(activeFileName, data);
      return;
    }
    const encrypted = await encryptData(data, cryptoKey, salt);
    if (encrypted === null) {
      console.error("syncDatabaseToFile: Encryption returned null");
      return;
    }
    await fileTable.upsertFileRecord(activeFileName, encrypted);
    await exportVaultFile(activeFileName, encrypted);

    // Clear any previous sync error on success
    clearSyncError?.();
  } catch (error) {
    console.error("syncDatabaseToFile failed:", error);
    // Store error in sessionStore for UI to display
    const errorMessage = isFileStorageError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unknown sync error";
    setSyncError?.(errorMessage);
    // Don't throw - auto-save should not break the app
  }
};

type ReplaceDatabaseDataParams =
  | {
      data: KiyoVaultData;
      fileName: string;
      cryptoKey?: undefined;
      encryptedFileData?: undefined;
    }
  | {
      data: KiyoVaultData;
      fileName: string;
      cryptoKey: CryptoKey;
      encryptedFileData: EncryptedKiyoVaultData;
    };

export const replaceDatabaseData = async (params: ReplaceDatabaseDataParams): Promise<void> => {
  const { data, fileName, cryptoKey, encryptedFileData } = params;
  
  const fileDataToSave = cryptoKey ? encryptedFileData : data;
  if (cryptoKey && !encryptedFileData || !fileDataToSave) {
    throw new Error("저장할 파일 데이터가 없습니다.");
  }

  await db.transaction(
    "rw",
    db.accounts,
    db.templates,
    db.metadata,
    db.files,
    async () => {
      await db.accounts.clear();
      await db.templates.clear();
      await db.metadata.clear();
      await db.files.clear();

      // Insert accounts and templates with encryption using restore to preserve IDs
      if (cryptoKey) {
        await accountTable.bulkRestore(data.accounts, cryptoKey);
        await templateTable.bulkRestore(data.templates, cryptoKey);
      } else {
        // Fallback - should not happen in production
        await accountTable.bulkRestore(data.accounts);
        await templateTable.bulkRestore(data.templates);
      }

      await db.metadata.bulkPut(data.metadata);

      // Save file data to files table (encrypted or plain based on cryptoKey presence)
      await fileTable.upsertFileRecord(fileName, fileDataToSave);
    },
  );
};

export const initializeDatabase = async () => {
  console.log("Initializing database...");
  const metadata = {
        id: 1,
        version: "1.0.0",
        createdAt: Date.now(),
      }
  await db.transaction(
    "rw",
    db.metadata,
    async () => {
      await db.metadata.put(metadata);
    },
  );
  return metadata;
};

// Get database instance
export const getDatabase = () => db;

// Helper functions
export const isNativeFileStorageAvailable = () => Capacitor.isNativePlatform();