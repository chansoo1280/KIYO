import { Capacitor } from "@capacitor/core";
import Dexie, { type EntityTable, type Table } from "dexie";
import { encryptData, type EncryptedKiyoFile } from "@/crypto/encryption";
import { writeDataFile, type KiyoDataFile } from "@/database/fileStorage";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import type {
  AppSettings,
  FileMetadata,
} from "@/models/account";
import { isFileStorageError } from "@/errors/FileStorageError";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import type { AccountRecord } from "@/database/accountTable";
import type { TemplateRecord } from "@/database/templateTable";

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
  accounts!: EntityTable<AccountRecord, "id">;
  templates!: EntityTable<TemplateRecord, "id">;
  settings!: Table<AppSettings, number>;
  metadata!: Table<FileMetadata, number>;
  files!: Table<FileData, number>;

  constructor() {
    super("kiyo-db");
    this.version(12)
      .stores({
        accounts:
          "++id, createdAt, updatedAt",
        templates:
          "++id, createdAt, updatedAt",
        settings:
          "++id, theme, lockEnabled, autoLockTime, fontSize, biometricEnabled",
        metadata: "id, version, createdAt",
        files: "++id, fileName, createdAt, updatedAt",
      })
      .upgrade((transaction) => {
        // v11: Replace accounts/templates with encrypted record tables
        // Clear old tables - no migration, fresh start
        transaction.table("accounts").clear();
        transaction.table("templates").clear();
      });
  }
}

export const db = new KiyoDatabase();

export const getDatabaseSnapshot = async (
  filename: string,
): Promise<KiyoDataFile> => {
  const sessionState = useSessionStore.getState();
  const cryptoKey = sessionState.cryptoKey ?? undefined;

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
    const data = await getDatabaseSnapshot(activeFileName);
    
    // Also write to filesystem
    if (!cryptoKey || !salt) {
      await fileTable.create(activeFileName, data);
      await writeDataFile(data, activeFileName);
      return;
    }
    const encrypted = await encryptData(data, cryptoKey, salt);
    if (encrypted === null) {
      console.error("syncDatabaseToFile: Encryption returned null");
      return;
    }
    await fileTable.create(activeFileName, encrypted, salt);
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

export interface ReplaceDatabaseDataParams {
  data: KiyoDataFile;
  fileName: string;
  cryptoKey?: CryptoKey;
  salt?: Uint8Array;
  // 이미 암호화된 파일 데이터가 있으면 그대로 사용 (파일 테이블에 암호화된 상태로 저장하기 위함)
  encryptedFileData?: EncryptedKiyoFile;
}

export const replaceDatabaseData = async ({
  data,
  fileName,
  cryptoKey,
  salt = undefined,
  encryptedFileData,
}: ReplaceDatabaseDataParams): Promise<void> => {
  const fileDataToSave = cryptoKey?encryptedFileData:data;
  if(cryptoKey && !encryptedFileData || !fileDataToSave) {
    throw new Error("저장할 파일 데이터가 없습니다.");
  }

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
      await fileTable.create(fileName, fileDataToSave, salt);
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