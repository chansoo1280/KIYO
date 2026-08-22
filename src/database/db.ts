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
import { isNativeFileStorageAvailable } from "@/database/fileExport";
import { createEncryptedRecord, createPlaintextRecord } from "@/crypto/recordEncryption";

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

/**
 * Persist vault snapshot to files table (internal auto-save)
 * Does NOT write to external filesystem - use exportBackupFile for that
 */
export const persistVaultSnapshot = async (params: SyncDatabaseParams): Promise<void> => {
  const { activeFileName, cryptoKey, salt, clearSyncError, setSyncError } = params;

  try {
    if (!activeFileName) {
      console.warn("persistVaultSnapshot: No active file name");
      return;
    }
    if (!isNativeFileStorageAvailable()) {
      // 앱에서만 자동저장
      return;
    }
    const data = await getDatabaseSnapshot(activeFileName, cryptoKey ?? undefined);
    
    if (!cryptoKey) {
      await fileTable.upsertFileRecord(activeFileName, data);
      return;
    }
    const encrypted = await encryptData(data, cryptoKey, salt!);
    if (encrypted === null) {
      console.error("persistVaultSnapshot: Encryption returned null");
      return;
    }
    await fileTable.upsertFileRecord(activeFileName, encrypted);

    // Clear any previous sync error on success
    clearSyncError?.();
  } catch (error) {
    console.error("persistVaultSnapshot failed:", error instanceof Error ? error.message : String(error), error);
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

// Deprecated alias for backward compatibility
export const syncDatabaseToFile = persistVaultSnapshot;

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

  // === 1단계: 트랜잭션 밖에서 암호화 완료 ===
  let accountRecords: AccountRecord[] = [];
  let templateRecords: TemplateRecord[] = [];

  if (cryptoKey) {
    const now = Date.now();
    // 계정 암호화
    accountRecords = await Promise.all(
      data.accounts.map(async (account) => {
        const encryptedRecord = await createEncryptedRecord({ ...account, updatedAt: now }, cryptoKey);
        return {
          id: account.id,
          ...encryptedRecord,
          createdAt: account.createdAt,
          updatedAt: now,
        };
      })
    );
    // 템플릿 암호화
    templateRecords = await Promise.all(
      data.templates.map(async (template) => {
        const encryptedRecord = await createEncryptedRecord({ ...template, updatedAt: now }, cryptoKey);
        return {
          id: template.id,
          ...encryptedRecord,
          createdAt: template.createdAt,
          updatedAt: now,
        };
      })
    );
  } else {
    // 평문 레코드 생성
    const now = Date.now();
    accountRecords = await Promise.all(
      data.accounts.map(async (account) => {
        const plaintextRecord = await createPlaintextRecord({ ...account, updatedAt: now });
        return {
          id: account.id,
          ...plaintextRecord,
          createdAt: account.createdAt,
          updatedAt: now,
        };
      })
    );
    templateRecords = await Promise.all(
      data.templates.map(async (template) => {
        const plaintextRecord = await createPlaintextRecord({ ...template, updatedAt: now });
        return {
          id: template.id,
          ...plaintextRecord,
          createdAt: template.createdAt,
          updatedAt: now,
        };
      })
    );
  }

  // === 2단계: 짧은 트랜잭션으로 DB 저장만 ===
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

      // 이미 완성된 레코드 바로 bulkPut
      await db.accounts.bulkPut(accountRecords);
      await db.templates.bulkPut(templateRecords);

      await db.metadata.bulkPut(data.metadata);
      await fileTable.upsertFileRecord(fileName, fileDataToSave);
    },
  );
};

export const initializeDatabase = async () => {
  if (import.meta.env.DEV) {
    console.log("Initializing database...");
  }
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