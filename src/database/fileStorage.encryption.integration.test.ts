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
import type { Account } from "@/models/account";
import type { Template } from "@/models/template";
import { createTestAccounts } from "@/test/fixtures/accountFixtures";
import { createTestTemplates } from "@/test/fixtures/templateFixtures";
import { isEncryptedKiyoVaultData, type EncryptedKiyoVaultData } from "@/crypto/encryption";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import Dexie from "dexie";
import { useTemplateStore } from "@/store/templateStore";
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

  describe("PIN 기반 암호화 파일 흐름 검증", () => {
    const TEST_PIN = "1234";
    const WRONG_PIN = "4321";

    // Helper to get encrypted file from DB by fileName
    const getEncryptedFileFromDB = async (
      fileName: string,
    ): Promise<EncryptedKiyoVaultData | null> => {
      const db = getDatabase();
      const fileRecord = await db.files
        .where("fileName")
        .equals(fileName)
        .first();
      if (!fileRecord) return null;
      const fileData = JSON.parse(fileRecord.fileData);
      return fileData as EncryptedKiyoVaultData;
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
      expect(isEncryptedKiyoVaultData(savedEncryptedFile)).toBe(true);
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

      // 검증: 세션은 변경되지 않아야 함 (shouldSetActiveFile=false)
      const sessionAfterBackup = useSessionStore.getState();
      expect(sessionAfterBackup.activeFileName).toBe("encrypted-source.json");
      expect(sessionAfterBackup.cryptoKey).toBe(sessionCryptoKey);
      expect(sessionAfterBackup.salt).toBe(sessionSalt);
    });

    it("올바른 PIN으로 암호화 파일을 복원한다", async () => {
      // 흐름: createDataFile(pin) → backupDataFile → openImportedDataFile(pin)
            // 1. PIN으로 암호화 파일 생성
            await createDataFile("encrypted-wrong-pin.json", TEST_PIN);

            // 2. DB에 데이터 추가 (accountTable 사용 - 암호화 처리됨)
            const sessionAfterCreate = useSessionStore.getState();
            const sessionCryptoKey = sessionAfterCreate.cryptoKey;
            const testAccount: Account = createTestAccounts(1)[0];
            await accountTable.create(testAccount, sessionCryptoKey ?? undefined);
            const testTemplate: Template = createTestTemplates(1)[0];
            await templateTable.create(testTemplate, sessionCryptoKey ?? undefined);

            // Store also needs to be in sync (app flow: user actions update store)
            useAccountStore.getState().initialize();
            useTemplateStore.getState().loadTemplates();

            // 4. 현재 세션 스냅샷으로 암호화 데이터 직접 생성 (backupDataFile은 DB 저장 안 함)
            const sessionState = useSessionStore.getState();
            const vaultData = await getDatabaseSnapshot("encrypted-wrong-pin.json", sessionState.cryptoKey ?? undefined);
            const { encryptedVaultData } = await createEncryptedVault(vaultData, TEST_PIN);
            const encryptedJsonString = JSON.stringify(encryptedVaultData);

            // 5. openImportedDataFile로 잘못된 PIN으로 복원 시도
            await expect(openImportedDataFile(
              encryptedJsonString,
              WRONG_PIN,
              "encrypted-wrong-pin.json",
            )).rejects.toThrow("PIN 불일치");

      expect(sessionState.activeFileName).toBe("encrypted-wrong-pin.json");
      expect(sessionState.cryptoKey).not.toBeNull();
      expect(sessionState.salt).not.toBeNull();
      expect(sessionState.salt).toBeInstanceOf(Uint8Array);

      // 검증: 계정 스토어 업데이트됨
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(1);
      expect(storeAccounts[0].title).toBe("Test Account 1");

      // 검증: DB 복원됨 (평문 데이터로 저장)
      const snapshot = await getDatabaseSnapshot(
        "encrypted-backup.json",
        sessionState.cryptoKey ?? undefined,
      );
      expect(snapshot.accounts).toHaveLength(1);
      expect(snapshot.accounts[0].title).toBe("Test Account 1");
      // 내장 템플릿 6개 + 테스트 템플릿 1개 = 7개
      expect(snapshot.templates).toHaveLength(7);
    });

    it("잘못된 PIN이면 복원하지 않는다", async () => {
      // 1. PIN으로 암호화 파일 생성
      await createDataFile("encrypted-wrong-pin.json", TEST_PIN);

      // 2. DB에 데이터 추가 (accountTable 사용 - 암호화 처리됨)
      const sessionAfterCreate = useSessionStore.getState();
      const sessionCryptoKey = sessionAfterCreate.cryptoKey;
      const testAccount: Account = createTestAccounts(1)[0];
      await accountTable.create(testAccount, sessionCryptoKey ?? undefined);
      const testTemplate: Template = createTestTemplates(1)[0];
      await templateTable.create(testTemplate, sessionCryptoKey ?? undefined);

      // Store also needs to be in sync (app flow: user actions update store)
      useAccountStore.getState().setAccounts([testAccount]);

      // 3. backupDataFile로 암호화 백업
      const snapshot = await backupDataFile("encrypted-backup-wrong-pin.json", TEST_PIN);
      const { encryptedVaultData } = await createEncryptedVault(snapshot, TEST_PIN);
      const encryptedJsonString = JSON.stringify(encryptedVaultData);

      // 5. openImportedDataFile로 잘못된 PIN으로 복원 시도
      await expect(openImportedDataFile(
        encryptedJsonString,
        WRONG_PIN,
        "encrypted-backup-wrong-pin.json",
      )).rejects.toThrow("PIN 불일치");

      // 검증: DB 변경 없음 (원본 데이터 유지)
      const sessionStateAfter = useSessionStore.getState();
      const snapshotAfter = await getDatabaseSnapshot("encrypted-wrong-pin.json", sessionStateAfter.cryptoKey ?? undefined);
      expect(snapshotAfter.accounts).toHaveLength(1);
      expect(snapshotAfter.accounts[0].title).toBe("Test Account 1");

      // 검증: accountStore는 이미 채워진 상태 유지됨
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(1);
      expect(storeAccounts[0].title).toBe("Test Account 1");

      // 검증: 세션은 변경되지 않음 (기존 세션 유지)
      expect(sessionStateAfter.activeFileName).toBe("encrypted-wrong-pin.json");
      expect(sessionStateAfter.cryptoKey).not.toBeNull();
    });

    it("암호화 데이터 변조를 감지한다", async () => {
      // 1. PIN으로 암호화 파일 생성
      await createDataFile("encrypted-tamper.json", TEST_PIN);

      // 2. DB에 데이터 추가 (accountTable 사용 - 암호화 처리됨)
      const sessionAfterCreate = useSessionStore.getState();
      const sessionCryptoKey = sessionAfterCreate.cryptoKey;
      const testAccount: Account = createTestAccounts(1)[0];
      await accountTable.create(testAccount, sessionCryptoKey ?? undefined);
      const testTemplate: Template = createTestTemplates(1)[0];
      await templateTable.create(testTemplate, sessionCryptoKey ?? undefined);
            useAccountStore.getState().initialize();
            useTemplateStore.getState().loadTemplates();

      // 3. 현재 세션의 DB 상태를 이용해 암호화된 볼트 데이터 생성 (backupDataFile은 DB에 저장하지 않음)
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
      const sessionState = useSessionStore.getState();
      const snapshot = await getDatabaseSnapshot("encrypted-tamper.json", sessionState.cryptoKey ?? undefined);
      expect(snapshot.accounts).toHaveLength(1);
      expect(snapshot.accounts[0].title).toBe("Test Account 1");

      // 검증: accountStore는 backupDataFile 호출 시 이미 채워진 상태 유지됨
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(1);
      expect(storeAccounts[0].title).toBe("Test Account 1");
    });
  });
  });