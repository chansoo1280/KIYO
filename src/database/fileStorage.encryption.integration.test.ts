import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import { getDatabaseSnapshot, getDatabase } from "@/database/db";
import {
  createDataFile,
  backupDataFile,
  openImportedDataFile,
  createEncryptedVault,
} from "@/database/fileStorage";
import type { Account, FileMetadata } from "@/models/account";
import type { Template } from "@/models/template";
import type { KiyoVaultData } from "@/models/vault";
import { createTestAccounts } from "@/test/fixtures/accountFixtures";
import { createTestTemplates, getBuiltinTemplates } from "@/test/fixtures/templateFixtures";
import { createCryptoKey, encryptData } from "@/crypto/encryption";
import { getDefaultMetadata } from "@/test/fixtures/databaseFixtures";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import Dexie from "dexie";
import { useTemplateStore } from "@/store/templateStore";

type Metadata = FileMetadata;

// Use real IndexedDB via Dexie (works in Vitest with jsdom)

describe("fileStorage Encryption Integration Tests", () => {
  beforeAll(async () => {
      // Clean up test database
      try {
        await Dexie.delete("kiyo-db");
      } catch {
        // Ignore cleanup errors
      }
    });

    afterAll(async () => {
    });

    // Helper to fully reset database and stores
    const resetTestEnvironment = async () => {
      const db = getDatabase();
      await db.accounts.clear();
      await db.templates.clear();
      await db.settings.clear();
      await db.metadata.clear();
      await db.files.clear();
      await useSessionStore.getState().clearSession();
      await useAccountStore.getState().setAccounts([]);
    };

    beforeEach(async () => {
      vi.spyOn(accountTable, "initializeDevData").mockResolvedValue(undefined);
      // Ensure clean state at start of each test
      await resetTestEnvironment();
      // Explicitly verify store is empty
      expect(useAccountStore.getState().accounts).toHaveLength(0);
    });

    afterEach(async () => {
      await resetTestEnvironment();
      vi.clearAllMocks();
    });

  // Helper to populate test data in database AND sync to account store
  const populateTestData = async (
    accounts = createTestAccounts(2),
    templates = createTestTemplates(2),
    metadata = getDefaultMetadata(),
  ) => {
    const sessionAfterCreate = useSessionStore.getState();
    const sessionCryptoKey = sessionAfterCreate.cryptoKey;

    for (const account of accounts) {
      await accountTable.create(account, sessionCryptoKey ?? undefined);
    }
    for (const template of templates) {
      await templateTable.create(template, sessionCryptoKey ?? undefined);
    }
    const db = getDatabase();
    await db.metadata.bulkPut(metadata);
    // Sync to account store
    await useAccountStore.getState().initialize();
    await useTemplateStore.getState().loadTemplates();
  };

  // Helper to backup with one PIN and restore with another PIN
  const backupWithPinAndRestoreWithPin = async (
    fileName: string,
    backupPin: string,
    restorePin: string,
  ) => {
    // Get current session's snapshot and salt, create encrypted vault data with existing salt
    // (backupDataFile doesn't save to DB anymore)
    const sessionState = useSessionStore.getState();
    const snapshot = await getDatabaseSnapshot(fileName, sessionState.cryptoKey ?? undefined);
    // Reuse existing salt from session so openImportedDataFile can decrypt with same salt
    const existingSalt = sessionState.salt;
    const { key } = await createCryptoKey(backupPin, existingSalt ?? undefined);
    const encryptedVaultData = await encryptData(snapshot, key, existingSalt!);
    const encryptedJsonString = JSON.stringify(encryptedVaultData);
    return openImportedDataFile(encryptedJsonString, restorePin, fileName);
  };

  // Comprehensive data integrity verification
  const verifyDataIntegrity = (
    importedFile: KiyoVaultData | null,
    expectedAccounts: Account[],
    expectedTemplates: Template[],
    expectedMetadata: Metadata[],
  ) => {
    expect(importedFile).not.toBeNull();
    expect(importedFile!.accounts).toHaveLength(expectedAccounts.length);
    expect(importedFile!.templates).toHaveLength(expectedTemplates.length);
    expect(importedFile!.metadata).toHaveLength(expectedMetadata.length);

    // Verify accounts - match by title since order is not guaranteed (DB sorts by updatedAt)
    for (const expectedAccount of expectedAccounts) {
      const importedAccount = importedFile!.accounts.find(
        (a) => a.title === expectedAccount.title
      );
      expect(importedAccount).toBeDefined();
      expect(importedAccount!.fields).toEqual(expectedAccount.fields);
    }

    // Verify templates - match by name since order is not guaranteed (DB sorts by sortOrder)
    for (const expectedTemplate of expectedTemplates) {
      const importedTemplate = importedFile!.templates.find(
        (t) => t.name === expectedTemplate.name
      );
      expect(importedTemplate).toBeDefined();
      expect(importedTemplate!.fields).toEqual(expectedTemplate.fields);
    }

    // Verify metadata - order should be preserved by id
    for (let i = 0; i < expectedMetadata.length; i++) {
      expect(importedFile!.metadata[i].version).toBe(expectedMetadata[i].version);
    }
  };

  describe("PIN 기반 암호화 파일 흐름 검증", () => {
    const TEST_PIN = "1234";
    const WRONG_PIN = "4321";

    // Helper to get encrypted file from DB by fileName
    const getEncryptedFileFromDB = async (
      fileName: string,
    ) => {
      const db = getDatabase();
      const fileRecord = await db.files
        .where("fileName")
        .equals(fileName)
        .first();
      if (!fileRecord) return null;
      const fileData = JSON.parse(fileRecord.fileData);
      return fileData;
    };

    it("PIN으로 암호화 파일을 생성한다", async () => {
      // 1. PIN으로 암호화 파일 생성
      const fileName = "encrypted-create.json";
      const createdFile = await createDataFile(fileName, TEST_PIN);

      // 검증: 반환값은 평문 데이터 (암호화되지 않음)
      expect(createdFile).toBeDefined();
      expect(createdFile.fileName).toBe("encrypted-create.json");
      expect(createdFile.version).toBe(1);
      expect("encrypted" in createdFile).toBe(false);
      expect(createdFile.accounts).toEqual([]);
      // 내장 템플릿 6개가 자동 시드됨
      expect(createdFile.templates).toHaveLength(6);
      // initializeDatabase가 메타데이터 레코드 1개를 생성함
      expect(createdFile.metadata).toHaveLength(1);
      expect(createdFile.metadata[0].version).toBe("1.0.0");

      // 검증: 세션에 cryptoKey와 salt가 저장되었는지 확인
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("encrypted-create.json");
      expect(sessionState.cryptoKey).not.toBeNull();
      expect(sessionState.salt).not.toBeNull();
      expect(sessionState.salt).toBeInstanceOf(Uint8Array);
      expect(sessionState.salt!.byteLength).toBe(16); // 16 bytes for AES-GCM

      // 검증: DB에 저장된 데이터는 암호화되어 있어야 함
      const savedEncryptedFile = await getEncryptedFileFromDB(
        "encrypted-create.json",
      );
      expect(savedEncryptedFile).toBeDefined();
      expect(savedEncryptedFile!.encrypted).toBe(true);
      expect(savedEncryptedFile!.salt).toBeDefined();
      expect(savedEncryptedFile!.iv).toBeDefined();
      expect(savedEncryptedFile!.ciphertext).toBeDefined();
    });

    it("PIN으로 암호화 백업한다 (새 키 생성)", async () => {
      // 1. PIN으로 암호화 파일 생성 (세션에 cryptoKey, salt 저장됨)
      await createDataFile("encrypted-source.json", TEST_PIN);

      // 세션에 저장된 cryptoKey와 salt 확인
      const sessionAfterCreate = useSessionStore.getState();
      const sessionCryptoKey = sessionAfterCreate.cryptoKey;
      const sessionSalt = sessionAfterCreate.salt;
      expect(sessionCryptoKey).not.toBeNull();
      expect(sessionSalt).not.toBeNull();

      // 2. DB에 데이터 추가 (accountTable 사용 - 암호화 처리됨)
      const testAccount: Account = createTestAccounts(1)[0];
      await accountTable.create(testAccount, sessionCryptoKey ?? undefined);
      const testTemplate: Template = createTestTemplates(1)[0];
      await templateTable.create(testTemplate, sessionCryptoKey ?? undefined);

      // 3. backupDataFile로 백업 (PIN으로 새 키 생성 - 세션 키와 다름)
      const backedUpFile = await backupDataFile(
        "encrypted-backup.json",
        TEST_PIN,
      );

      // 검증: 반환값은 평문 데이터
      expect(backedUpFile).toBeDefined();
      expect(backedUpFile.fileName).toBe("encrypted-backup.json");
      expect("encrypted" in backedUpFile).toBe(false);
      expect(backedUpFile.accounts).toHaveLength(1);
      expect(backedUpFile.accounts[0].title).toBe("Test Account 1");
      // 내장 템플릿 6개 + 테스트 템플릿 1개 = 7개
      expect(backedUpFile.templates).toHaveLength(7);
      expect(backedUpFile.metadata).toHaveLength(1);

      // 검증: 세션은 변경되지 않아야 함 (backupDataFile은 세션 변경 안 함)
      const sessionAfterBackup = useSessionStore.getState();
      expect(sessionAfterBackup.activeFileName).toBe("encrypted-source.json");
      expect(sessionAfterBackup.cryptoKey).toBe(sessionCryptoKey);
      expect(sessionAfterBackup.salt).toBe(sessionSalt);
    });

    it("올바른 PIN으로 암호화 파일을 복원한다", async () => {
      // 1. PIN으로 암호화 파일 생성
      await createDataFile("encrypted-restore.json", TEST_PIN);

      // 2. DB에 데이터 추가 (accountTable 사용 - 암호화 처리됨)
      await populateTestData();

      // 3. backupWithPinAndRestoreWithPin으로 올바른 PIN으로 복원
      const imported = await backupWithPinAndRestoreWithPin("encrypted-restore.json", TEST_PIN, TEST_PIN);

      const accounts = createTestAccounts(2);
      const templates = createTestTemplates(2);
      const metadata = getDefaultMetadata();
      // 내장 템플릿 6개 + 테스트 템플릿 2개 = 8개
      const expectedTemplates = [...templates, ...getBuiltinTemplates()];

      verifyDataIntegrity(imported, accounts, expectedTemplates, metadata);

      // 세션이 업데이트되었는지 확인
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("encrypted-restore.json");
      expect(sessionState.cryptoKey).not.toBeNull();
      expect(sessionState.salt).not.toBeNull();
    });

    it("잘못된 PIN이면 복원하지 않는다 (원본 데이터 보존)", async () => {
      // 1. PIN으로 암호화 파일 생성
      await createDataFile("encrypted-wrong-pin.json", TEST_PIN);

      // 2. DB에 데이터 추가
      await populateTestData();

      // 3. backupWithPinAndRestoreWithPin로 잘못된 PIN으로 복원 시도
      await expect(
        backupWithPinAndRestoreWithPin("encrypted-wrong-pin.json", TEST_PIN, WRONG_PIN),
      ).rejects.toThrow("PIN 불일치");

      // 검증: DB 변경 없음 (원본 데이터 유지)
      const sessionStateAfter = useSessionStore.getState();
      const snapshotAfter = await getDatabaseSnapshot("encrypted-wrong-pin.json", sessionStateAfter.cryptoKey ?? undefined);
      expect(snapshotAfter.accounts).toHaveLength(2);
      const accountTitles = snapshotAfter.accounts.map((a) => a.title).sort();
      expect(accountTitles).toEqual(["Test Account 1", "Test Account 2"]);

      // 검증: 세션은 변경되지 않음 (기존 세션 유지)
      expect(sessionStateAfter.activeFileName).toBe("encrypted-wrong-pin.json");
      expect(sessionStateAfter.cryptoKey).not.toBeNull();
    });

    it("암호화 데이터 변조를 감지한다", async () => {
      // 1. PIN으로 암호화 파일 생성
      await createDataFile("encrypted-tamper.json", TEST_PIN);

      // 2. DB에 데이터 추가 (accountTable 사용 - 암호화 처리됨)
      await populateTestData();

      // 3. 현재 세션의 DB 상태를 이용해 암호화된 볼트 데이터 생성 (backupDataFile은 DB에 저장하지 않음)
      const sessionState = useSessionStore.getState();
      const sessionCryptoKey = sessionState.cryptoKey;
      const currentSnapshot = await getDatabaseSnapshot("encrypted-tamper.json", sessionCryptoKey ?? undefined);
      const { encryptedVaultData } = await createEncryptedVault(currentSnapshot, TEST_PIN);
      const tamperedFile = {
        ...encryptedVaultData,
        ciphertext: "AAAA", // 변조된 ciphertext
      };
      const tamperedJsonString = JSON.stringify(tamperedFile);

      // 4. openImportedDataFile로 올바른 PIN으로 복원 시도 (변조된 데이터로)
      await expect(openImportedDataFile(
        tamperedJsonString,
        TEST_PIN,
        "encrypted-backup-tamper.json",
      )).rejects.toThrow("PIN 불일치");

      // 검증: DB 변경 없음
      const sessionStateAfter = useSessionStore.getState();
      const snapshot = await getDatabaseSnapshot("encrypted-tamper.json", sessionStateAfter.cryptoKey ?? undefined);
      expect(snapshot.accounts).toHaveLength(2);
      const titles = snapshot.accounts.map((a) => a.title).sort();
      expect(titles).toEqual(["Test Account 1", "Test Account 2"]);
    });
  });
});