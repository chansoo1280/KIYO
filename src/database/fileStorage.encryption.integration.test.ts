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
import { getDatabaseSnapshot, getDatabase,  } from "@/database/db";
import {
  createDataFile,
  backupDataFile,
  openImportedDataFile,
} from "@/database/fileStorage";
import type { Account } from "@/models/account";
import type { Template } from "@/models/template";
import { createTestAccounts } from "@/test/fixtures/accountFixtures";
import { createTestTemplates } from "@/test/fixtures/templateFixtures";
import { fromBase64 } from "@/crypto/crypto.utils";
import { isEncryptedKiyoFile } from "@/database/fileStorage";
import { decryptData, type EncryptedKiyoFile } from "@/crypto/encryption";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import Dexie from "dexie";
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
    ): Promise<EncryptedKiyoFile | null> => {
      const db = getDatabase();
      const fileRecord = await db.files
        .where("fileName")
        .equals(fileName)
        .first();
      if (!fileRecord) return null;
      const fileData = JSON.parse(fileRecord.fileData);
      return fileData as EncryptedKiyoFile;
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
      expect(createdFile.metadata).toEqual([]);

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
      expect(isEncryptedKiyoFile(savedEncryptedFile)).toBe(true);
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

      // 검증: DB에 저장된 백업 파일은 암호화되어 있어야 함
      const savedEncryptedFile = await getEncryptedFileFromDB(
        "encrypted-backup.json",
      );
      expect(savedEncryptedFile).toBeDefined();
      expect(isEncryptedKiyoFile(savedEncryptedFile)).toBe(true);
      expect(savedEncryptedFile!.encrypted).toBe(true);
      expect(savedEncryptedFile!.salt).toBeDefined();
      expect(savedEncryptedFile!.iv).toBeDefined();
      expect(savedEncryptedFile!.ciphertext).toBeDefined();

      // 검증: 백업 파일의 salt는 세션의 salt와 다를 수 있음 (PIN으로 새 키 생성)
      // backupDataFile은 PIN으로 새 키를 생성하므로 salt가 다를 수 있음
      // (같은 PIN이라도 salt는 랜덤하게 생성됨)

      // 검증: 저장된 암호화 데이터를 백업 파일의 salt로 복호화 가능해야 함
      const backupSalt = fromBase64(savedEncryptedFile!.salt);
      const { key: backupKey } = await import("../crypto/encryption").then(
        (m) => m.createCryptoKey(TEST_PIN, backupSalt),
      );
      const decrypted = await decryptData(savedEncryptedFile!, backupKey);
      expect(decrypted.accounts).toHaveLength(1);
      expect(decrypted.accounts[0].title).toBe("Test Account 1");
      // 내장 템플릿 6개 + 테스트 템플릿 1개 = 7개
      expect(decrypted.templates).toHaveLength(7);
    });

    it("올바른 PIN으로 암호화 파일을 복원한다", async () => {
      // 흐름: createDataFile(pin) → backupDataFile → openImportedDataFile(pin)

      // 1. createDataFile로 암호화 파일 생성
      await createDataFile("encrypted-import-source.json", TEST_PIN);

      // 2. DB에 데이터 추가 (accountTable 사용 - 암호화 처리됨)
      const sessionAfterCreate = useSessionStore.getState();
      const sessionCryptoKey = sessionAfterCreate.cryptoKey;
      const testAccount: Account = createTestAccounts(1)[0];
      await accountTable.create(testAccount, sessionCryptoKey ?? undefined);
      const testTemplate: Template = createTestTemplates(1)[0];
      await templateTable.create(testTemplate, sessionCryptoKey ?? undefined);

      // 3. backupDataFile로 암호화 백업
      await backupDataFile("encrypted-backup.json", TEST_PIN);

      // 4. DB에서 저장된 암호화 파일 가져오기 (실제 저장된 암호화 데이터)
      const savedEncryptedFile = await getEncryptedFileFromDB(
        "encrypted-backup.json",
      );
      expect(savedEncryptedFile).toBeDefined();
      expect(isEncryptedKiyoFile(savedEncryptedFile)).toBe(true);

      // 5. 암호화된 데이터를 JSON 문자열로 변환하여 import
      const encryptedJsonString = JSON.stringify(savedEncryptedFile);

      // 6. openImportedDataFile로 올바른 PIN으로 복원
      const importedFile = await openImportedDataFile(
        encryptedJsonString,
        TEST_PIN,
        "encrypted-backup.json",
      );

      // 검증: 복호화 성공, 평문 데이터 반환
      expect(importedFile).not.toBeNull();
      expect(importedFile!.fileName).toBe("encrypted-backup.json");
      expect(importedFile!.version).toBe(1);
      expect("encrypted" in importedFile!).toBe(false); // 복호화된 평문 파일
      // 검증: 복원된 데이터 검증
      expect(importedFile).not.toBeNull();
      expect(importedFile!.accounts).toHaveLength(1);
      expect(importedFile!.accounts[0].title).toBe("Test Account 1");
      // 내장 템플릿 6개 + 테스트 템플릿 1개 = 7개
      expect(importedFile!.templates).toHaveLength(7);
      // 테스트 템플릿이 포함되어 있는지 확인 (내장 템플릿 6개 뒤에 추가됨)
      expect(importedFile!.templates.find(t => t.name === "Test Template 1")).toBeDefined();
      expect(importedFile!.metadata).toHaveLength(1);
      // 검증: 세션에 cryptoKey와 salt 저장됨
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("encrypted-backup.json");
      expect(sessionState.cryptoKey).not.toBeNull();
      expect(sessionState.salt).not.toBeNull();
      expect(sessionState.salt).toBeInstanceOf(Uint8Array);

      // 검증: 계정 스토어 업데이트됨
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(1);
      expect(storeAccounts[0].title).toBe("Test Account 1");

      // 검증: DB 복원됨 (평문 데이터로 저장)
      const snapshot = await getDatabaseSnapshot("encrypted-backup.json");
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

      // 3. backupDataFile로 암호화 백업 (이 과정에서 accountStore에 데이터가 들어감)
      await backupDataFile("encrypted-backup-wrong-pin.json", TEST_PIN);

      // 4. DB에서 저장된 암호화 파일 가져오기 (실제 저장된 암호화 데이터)
      const savedEncryptedFile = await getEncryptedFileFromDB(
        "encrypted-backup-wrong-pin.json",
      );
      expect(savedEncryptedFile).toBeDefined();
      expect(isEncryptedKiyoFile(savedEncryptedFile)).toBe(true);

      // 5. 암호화된 데이터를 JSON 문자열로 변환하여 import
      const encryptedJsonString = JSON.stringify(savedEncryptedFile);

      // 6. openImportedDataFile로 잘못된 PIN으로 복원 시도
      await expect(openImportedDataFile(
        encryptedJsonString,
        WRONG_PIN,
        "encrypted-backup-wrong-pin.json",
      )).rejects.toThrow("PIN 불일치");


      // 검증: DB 변경 없음 (원본 데이터 유지)
      const snapshot = await getDatabaseSnapshot("encrypted-wrong-pin.json");
      expect(snapshot.accounts).toHaveLength(1);
      expect(snapshot.accounts[0].title).toBe("Test Account 1");

      // 검증: accountStore는 backupDataFile 호출 시 이미 채워진 상태 유지됨
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(1);
      expect(storeAccounts[0].title).toBe("Test Account 1");

      // 검증: 세션은 변경되지 않음 (기존 세션 유지)
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("encrypted-wrong-pin.json");
      expect(sessionState.cryptoKey).not.toBeNull();
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

      // 3. backupDataFile로 암호화 백업 (이 과정에서 accountStore에 데이터가 들어감)
      await backupDataFile("encrypted-backup-tamper.json", TEST_PIN);

      // 4. DB에서 저장된 암호화 파일 가져오기 (실제 저장된 암호화 데이터)
      const savedEncryptedFile = await getEncryptedFileFromDB(
        "encrypted-backup-tamper.json",
      );
      expect(savedEncryptedFile).toBeDefined();
      expect(isEncryptedKiyoFile(savedEncryptedFile)).toBe(true);

      // 5. ciphertext 변조
      const tamperedFile = {
        ...savedEncryptedFile!,
        ciphertext: "AAAA", // 변조된 ciphertext
      };
      const tamperedJsonString = JSON.stringify(tamperedFile);

      // 6. openImportedDataFile로 올바른 PIN으로 복원 시도 (변조된 데이터로)
      await expect(openImportedDataFile(
        tamperedJsonString,
        TEST_PIN,
        "encrypted-backup-tamper.json",
      )).rejects.toThrow("PIN 불일치");

      // 검증: DB 변경 없음
      const snapshot = await getDatabaseSnapshot("encrypted-tamper.json");
      expect(snapshot.accounts).toHaveLength(1);
      expect(snapshot.accounts[0].title).toBe("Test Account 1");

      // 검증: accountStore는 backupDataFile 호출 시 이미 채워진 상태 유지됨
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(1);
      expect(storeAccounts[0].title).toBe("Test Account 1");
    });
  });
});