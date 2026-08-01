import { Capacitor } from "@capacitor/core";
import Dexie, { type EntityTable, type Table } from "dexie";
import { encryptData } from "@/crypto/encryption";
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

export interface AccountRecord {
  id: number;
  version: 1;
  algorithm: "AES-GCM";
  encryptedData: Uint8Array;
  iv: Uint8Array;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateRecord {
  id: string;
  version: 1;
  algorithm: "AES-GCM";
  encryptedData: Uint8Array;
  iv: Uint8Array;
  createdAt: number;
  updatedAt: number;
}

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
  const sessionState = useSessionStore.getState();
  const cryptoKey = sessionState.cryptoKey;

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

      // Insert accounts and templates with encryption using restore to preserve IDs
      if (cryptoKey) {
        await accountTable.bulkRestore(data.accounts, cryptoKey);
        await templateTable.bulkRestore(data.templates, cryptoKey);
      } else {
        // Fallback - should not happen in production
        await db.accounts.bulkPut(
          data.accounts.map((a) => ({
            ...a,
            id: a.id as number,
            version: 1,
            algorithm: "AES-GCM" as const,
            encryptedData: new TextEncoder().encode(JSON.stringify(a)),
            iv: new Uint8Array(12),
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          })),
        );
        await db.templates.bulkPut(
          data.templates.map((t) => ({
            ...t,
            version: 1,
            algorithm: "AES-GCM" as const,
            encryptedData: new TextEncoder().encode(JSON.stringify(t)),
            iv: new Uint8Array(12),
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
        );
      }

      await db.metadata.bulkPut(data.metadata);
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