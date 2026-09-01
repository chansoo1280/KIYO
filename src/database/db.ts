import Dexie, { type EntityTable, type Table } from "dexie";
import { encryptData, type EncryptedKiyoVaultData } from "@/crypto/encryption";
import type { KiyoVaultData } from "@/models/vault";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import type {
  AppSettings,
  FileMetadata,
} from "@/models/account";
import { mapError } from "@/utils/mapError";
import { fileTable } from "@/database/fileTable";
import type { AccountRecord } from "@/database/accountTable";
import type { TemplateRecord } from "@/database/templateTable";
import { createEncryptedRecord, createPlaintextRecord } from "@/crypto/recordEncryption";
import { useSettingsStore } from "@/store/settingsStore";
import { writeBackupToUri } from "@/database/fileExport";

export interface FileRecord {
  id: string; // PK = fileName (v14)
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
  files!: Table<FileRecord, string>;

  constructor() {
    super("kiyo-db");
    // v13: PK changes from ++id (auto-increment number) to id (out-of-line key).
    // Dexie preserves the existing number PK, but the rest of the codebase assumes
    // a single fixed "active" PK. Wipe the v12 rows so the next write seeds a
    // fresh "active" row. Data loss is 0: vault snapshot lives in the file-system
    // .json backup and is restored via the import flow.
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
        transaction.table("files").clear();
      });

    // v14: PK is now fileName (string) instead of the "active" literal.
    // Migrate the v13 row by rewriting its id to its fileName — data loss 0.
    this.version(14)
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
      .upgrade(async (transaction) => {
        // v13 row 1개(id="active")를 fileName PK로 승계 — 데이터 손실 0.
        // Dexie 4의 put은 PK가 변경되면 새 row로 처리될 수 있으므로
        // delete + put 패턴으로 안전하게 승계.
        const rows = await transaction.table("files").toArray();
        for (const row of rows) {
          if (row.id === "active" && row.fileName) {
            const newId = row.fileName;
            await transaction.table("files").delete("active");
            await transaction.table("files").put({ ...row, id: newId });
          }
        }
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
    const data = await getDatabaseSnapshot(activeFileName, cryptoKey ?? undefined);

    if (!cryptoKey) {
      await fileTable.upsertFileRecord(activeFileName, data);
      // 평문 볼트는 자동 백업 안 함
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

    // [NEW] 자동 백업: 성공 시에만, 설정 확인 후 비동기 실행
    tryTriggerAutoBackup({ activeFileName, cryptoKey, salt });
  } catch (error) {
    console.error("persistVaultSnapshot failed:", error instanceof Error ? error.message : String(error), error);
    // 한국어 매핑된 에러 메시지를 store에 저장 → SyncErrorBanner가 표시
    setSyncError?.(mapError(error));
    // Don't throw - auto-save should not break the app
  }
};

async function tryTriggerAutoBackup(params: SyncDatabaseParams) {
  const { autoBackupEnabled, autoBackupUri } = useSettingsStore.getState();
  if (!autoBackupEnabled || !autoBackupUri) return;
  if (!params.cryptoKey || !params.salt) return; // 평문 볼트는 자동 백업 안 함 (정책)

  const data = await getDatabaseSnapshot(params.activeFileName!, params.cryptoKey);
  const encrypted = await encryptData(data, params.cryptoKey, params.salt!);
  if (encrypted) {
    const result = await writeBackupToUri(autoBackupUri, encrypted);
    if (!result.success) {
      console.warn("[autoBackup] writeBackupToUri failed:", result.errorCode, result.errorMessage);
      // 권한 만료 시 자동 OFF + UI 경고
      if (result.errorCode === "PERMISSION_REVOKED") {
        await useSettingsStore.getState().setAutoBackupEnabled(false);
      }
    } else {
      console.log("[autoBackup] writeBackupToUri succeeded");
    }
  }
}

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
  if (!fileDataToSave) {
    throw new Error("저장할 파일 데이터가 없습니다.");
  }
  if (!fileName) {
    throw new Error("fileName이 필요합니다.");
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
      // files는 clear하지 않음 — multi-vault 모델에서 이전 vault row 보존.
      // active fileName 1개만 upsert하여 새 vault로 갈아탄다.

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