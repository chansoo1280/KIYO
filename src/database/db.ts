import { Capacitor } from "@capacitor/core";
import Dexie, { type Table } from "dexie";
import { encryptData } from "@/crypto/encryption";
import { writeDataFile, type KiyoDataFile } from "@/database/fileStorage";
import type {
  Account,
  AppSettings,
  FileMetadata,
} from "@/models/account";
import type { Template } from "@/models/template";
import { isFileStorageError } from "@/errors/FileStorageError";
import { fileTable } from "@/database/fileTable";

export interface FileData {
  id: number;
  fileName: string;
  fileData: string; // JSON string of KiyoDataFile (encrypted or plain)
  encrypted: boolean;
  salt?: string;
  createdAt: number;
  updatedAt: number;
}

export class KiyoDatabase extends Dexie {
  accounts!: Table<Account, number>;
  templates!: Table<Template, string>; // 사용자 템플릿 (기존 accountTemplates -> templates로 이름 변경)
  settings!: Table<AppSettings, number>;
  metadata!: Table<FileMetadata, number>;
  files!: Table<FileData, number>;

  constructor() {
    super("kiyo-db");
    this.version(10)
      .stores({
        accounts:
          "id, templateId, title, *tags, favorite, createdAt, updatedAt, websiteUrl, domain, packageName",
        templates: "++id, name, sortOrder, updatedAt", // 템플릿 테이블 (기존 accountTemplates -> templates로 이름 변경)
        settings:
          "++id, theme, lockEnabled, autoLockTime, fontSize, biometricEnabled",
        metadata: "id, version, createdAt",
        files: "++id, fileName, createdAt, updatedAt",
      })
      .upgrade((transaction) =>
        transaction
          .table("settings")
          .toCollection()
          .modify({ fontSize: "medium" }),
      )
      .upgrade((transaction) =>
        transaction.table("accounts").toCollection().modify({ templateId: 1 }),
      )
      .upgrade((transaction) =>
        transaction
          .table("accounts")
          .toCollection()
          .modify({ websiteUrl: "", domain: "", packageName: "" }),
      )
      .upgrade((transaction) =>
        transaction
          .table("settings")
          .toCollection()
          .modify({ biometricEnabled: true }),
      );
    // v10: templates 테이블 이름 변경 (accountTemplates -> templates), 마이그레이션 없음
  }
}

export const db = new KiyoDatabase();

export const getDatabaseSnapshot = async (
  filename: string,
): Promise<KiyoDataFile> => ({
  version: 1,
  fileName: filename || "kiyo-data.json",
  updatedAt: Date.now(),
  accounts: await db.accounts.toArray(),
  templates: await db.templates.toArray(),
  metadata: await db.metadata.toArray(),
  // Note: files table is intentionally excluded from JSON export
  // Note: settings table is intentionally excluded from JSON export
});

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
    const data = await getDatabaseSnapshot(activeFileName);

    // Save to DB first
    await fileTable.saveFileDataToDB(activeFileName, data, salt || undefined);

    // Also write to filesystem
    if (!cryptoKey || !salt) {
      await writeDataFile(data, activeFileName);
      return;
    }
    const encrypted = await encryptData(data, cryptoKey, salt);
    if (encrypted === null) {
      console.error("syncDatabaseToFile: Encryption returned null");
      return;
    }
    await writeDataFile(encrypted, activeFileName);

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

export const replaceDatabaseData = async (
  data: KiyoDataFile,
): Promise<void> => {
  await db.transaction(
    "rw",
    db.accounts,
    db.templates,
    db.settings,
    db.metadata,
    db.files,
    async () => {
      await db.accounts.clear();
      await db.templates.clear();
      await db.settings.clear();
      await db.metadata.clear();
      await db.accounts.bulkPut(data.accounts);
      await db.templates.bulkPut(data.templates);
      // settings is no longer in KiyoDataFile - keep existing settings in DB
      await db.metadata.bulkPut(data.metadata);
    },
  );
};

export const initializeDatabase = async () => {
  console.log("Initializing database...");
  await db.transaction(
    "rw",
    db.metadata,
    async () => {
      await db.metadata.put({
        id: 1,
        version: "1.0.0",
        createdAt: Date.now(),
      });
    },
  );
};

// Get database instance
export const getDatabase = () => db;

// Helper functions
export const isNativeFileStorageAvailable = () => Capacitor.isNativePlatform();