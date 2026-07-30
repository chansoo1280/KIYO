import { Capacitor } from "@capacitor/core";
import Dexie, { type Table } from "dexie";
import { useSessionStore } from "../store/sessionStore";
import { encryptData, isEncryptedKiyoFile } from "../crypto/encryption";
import { writeDataFile, type KiyoDataFile } from "../database/fileStorage";
import { toBase64, fromBase64 } from "../crypto/crypto.utils";
import type { EncryptedKiyoFile } from "../crypto/encryption";
import type {
  Account,
  AppSettings,
  FileMetadata,
} from "../models/account";
import type { Template } from "../models/template";
import { devAccounts } from "./testdata";
import { isFileStorageError } from "../errors/FileStorageError";
import {
  encryptAccountsSensitiveFields,
  decryptAccountsSensitiveFields,
  hasEncryptedFields,
} from "../crypto/fieldEncryption";

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

export const syncDatabaseToFile = async (): Promise<void> => {
  try {
    const { activeFileName, cryptoKey, salt } = useSessionStore.getState();

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
    await saveFileDataToDB(activeFileName, data, salt || undefined);

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
    useSessionStore.getState().clearSyncError();
  } catch (error) {
    console.error("syncDatabaseToFile failed:", error);
    // Store error in sessionStore for UI to display
    const errorMessage = isFileStorageError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unknown sync error";
    useSessionStore.getState().setSyncError(errorMessage);
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
  if (!import.meta.env.DEV) {
    await db.transaction("rw", db.metadata, async () => {
      await db.metadata.put({
        id: 1,
        version: "1.0.0",
        createdAt: Date.now(),
      });
    });
    return;
  }
  const count = await db.accounts.count();

  if (count > 0) return;

  await db.transaction(
    "rw",
    db.accounts,
    db.metadata,
    async () => {
      await db.accounts.bulkPut(devAccounts);
      await db.metadata.put({
        id: 1,
        version: "1.0.0",
        createdAt: Date.now(),
      });
    },
  );

  console.log("개발용 seed 데이터가 추가되었습니다.");
};

export const loadAccountsFromDB = async (): Promise<Account[]> => {
  const accounts = await db.accounts.orderBy("updatedAt").reverse().toArray();

  // Check if we have a crypto key in session (encrypted file)
  const { cryptoKey } = useSessionStore.getState();

  if (cryptoKey && accounts.length > 0) {
    // Check if any account has encrypted fields
    const hasEncrypted = accounts.some(hasEncryptedFields);
    if (hasEncrypted) {
      try {
        return await decryptAccountsSensitiveFields(accounts, cryptoKey);
      } catch (error) {
        console.error("Failed to decrypt account fields:", error);
        // Return accounts as-is if decryption fails
        return accounts;
      }
    }
  }

  return accounts;
};

/**
 * Save accounts to database with field-level encryption for sensitive fields
 */
export const saveAccountsToDB = async (
  accounts: Account[],
  cryptoKey?: CryptoKey,
): Promise<void> => {
  let accountsToSave = accounts;

  // Encrypt sensitive fields if crypto key is available
  if (cryptoKey && accounts.length > 0) {
    try {
      accountsToSave = await encryptAccountsSensitiveFields(
        accounts,
        cryptoKey,
      );
    } catch (error) {
      console.error("Failed to encrypt account fields:", error);
      // Save without encryption if encryption fails
    }
  }

  await db.accounts.bulkPut(accountsToSave);
};

/**
 * Migrate existing plaintext accounts to encrypted format
 * This should be called when unlocking an encrypted file for the first time
 */
// export const migrateAccountsToEncryptedFormat = async (
//   cryptoKey: CryptoKey,
// ): Promise<void> => {
//   const accounts = await db.accounts.toArray();

//   if (accounts.length === 0) return;

//   // Check if any accounts need migration
//   const needsMigration = accounts.some(
//     (account) => !hasEncryptedFields(account),
//   );

//   if (needsMigration) {
//     try {
//       const migratedAccounts = await migrateAccountsToEncrypted(
//         accounts,
//         cryptoKey,
//       );
//       await db.accounts.bulkPut(migratedAccounts);
//       console.log(
//         `Migrated ${migratedAccounts.length} accounts to encrypted format`,
//       );
//     } catch (error) {
//       console.error("Failed to migrate accounts to encrypted format:", error);
//       throw error;
//     }
//   }
// };

// Save active file info to files table (update salt only, don't touch other fields)
export const saveActiveFileInfo = async (
  fileName: string,
  salt?: Uint8Array,
): Promise<void> => {
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
};

// Get active file info from sessionStore (salt) and files table (fileData)
// Check sessionStore for salt to determine if file is encrypted
// If no salt in sessionStore, check DB record as fallback (e.g. after app restart)
export const getActiveFileInfo = async (): Promise<{
  activeFileName: string | null;
  salt: Uint8Array | null;
  encrypted: boolean;
  fileData: KiyoDataFile | EncryptedKiyoFile | null;
}> => {
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
};

// Save file data (encrypted or plain) to files table
// Determines encryption status from the data itself (EncryptedKiyoFile has encrypted: true)
export const saveFileDataToDB = async (
  fileName: string,
  fileData: KiyoDataFile | EncryptedKiyoFile,
  salt?: Uint8Array,
): Promise<void> => {
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
};

// Get all file names from files table
export const getAllFileNames = async (): Promise<string[]> => {
  const files = await db.files.toArray();
  return files.map((f) => f.fileName);
};

// Clear active file info from files table
export const clearActiveFileInfo = async (fileName?: string): Promise<void> => {
  if (fileName) {
    await db.files.where("fileName").equals(fileName).delete();
  } else {
    await db.files.clear();
  }
};

// Clear accounts table only (preserves templates, settings, metadata, files)
export const clearAccounts = async (): Promise<void> => {
  await db.accounts.clear();
};

// Get database instance
export const getDatabase = () => db;

// Helper functions
export const isNativeFileStorageAvailable = () => Capacitor.isNativePlatform();
