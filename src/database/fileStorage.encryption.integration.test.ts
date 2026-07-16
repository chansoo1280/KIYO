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
import { useSessionStore } from "../store/sessionStore";
import { useAccountStore } from "../store/accountStore";
import { getDatabaseSnapshot, getDatabase, clearActiveFileInfo } from "./db";
import {
  createDataFile,
  backupDataFile,
  openImportedDataFile,
} from "./fileStorage";
import type { Account, Template } from "../models/account";
import { createTestAccounts } from "../test/fixtures/accountFixtures";
import { createTestTemplates } from "../test/fixtures/templateFixtures";
import { fromBase64 } from "../crypto/crypto.utils";
import { isEncryptedKiyoFile } from "./fileStorage";
import { decryptData, type EncryptedKiyoFile } from "../crypto/encryption";

// Mock Capacitor - web platform
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

// Mock Filesystem for web platform
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error("File not found")),
  },
  Directory: {
    Documents: "DOCUMENTS",
  },
  Encoding: {
    UTF8: "utf8",
  },
}));

// Use real IndexedDB via Dexie (works in Vitest with jsdom)

describe("fileStorage Encryption Integration Tests", () => {
  let testDbName: string;

  beforeAll(async () => {
    // Use a unique test database name to avoid conflicts
    testDbName = `kiyo-test-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // We need to use a fresh database for each test run
    // Since Dexie uses IndexedDB, we'll use the real implementation
  });

  afterAll(async () => {
    // Clean up test database
    try {
      await indexedDB.deleteDatabase(testDbName);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // Helper to fully reset database and stores
  const resetTestEnvironment = async () => {
    const db = getDatabase();
    await db.accounts.clear();
    await db.templates.clear();
    await db.settings.clear();
    await db.metadata.clear();
    await db.files.clear();
    await clearActiveFileInfo();
    await useSessionStore.getState().clearSession();
    useAccountStore.getState().setAccounts([]);
    await db.accounts.clear();
    await db.templates.clear();
    await db.settings.clear();
    await db.metadata.clear();
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTestEnvironment();
  });

  afterEach(async () => {
    vi.resetAllMocks();
    await resetTestEnvironment();
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
      expect(createdFile.templates).toEqual([]);
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

      // 2. DB에 데이터 추가
      const db = getDatabase();
      const testAccount: Account = createTestAccounts(1)[0];
      await db.accounts.put(testAccount);
      const testTemplate: Template = createTestTemplates(1)[0];
      await db.templates.put(testTemplate);

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
      expect(backedUpFile.templates).toHaveLength(1);
      expect(backedUpFile.metadata).toHaveLength(0);

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
      expect(decrypted.templates).toHaveLength(1);
    });

    it("올바른 PIN으로 암호화 파일을 복원한다", async () => {
      // 흐름: createDataFile(pin) → backupDataFile → openImportedDataFile(pin)

      // 1. createDataFile로 암호화 파일 생성
      await createDataFile("encrypted-import-source.json", TEST_PIN);

      // 2. DB에 데이터 추가
      const db = getDatabase();
      const testAccount: Account = createTestAccounts(1)[0];
      await db.accounts.put(testAccount);
      const testTemplate: Template = createTestTemplates(1)[0];
      await db.templates.put(testTemplate);

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
      );

      // 검증: 복호화 성공, 평문 데이터 반환
      expect(importedFile).not.toBeNull();
      expect(importedFile!.fileName).toBe("encrypted-backup.json");
      expect(importedFile!.version).toBe(1);
      expect("encrypted" in importedFile!).toBe(false); // 복호화된 평문 파일

      // 검증: 데이터 동일성 확인
      expect(importedFile!.accounts).toHaveLength(1);
      expect(importedFile!.accounts[0].title).toBe("Test Account 1");
      expect(importedFile!.templates).toHaveLength(1);
      expect(importedFile!.templates[0].name).toBe("Test Template 1");

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
      expect(snapshot.templates).toHaveLength(1);
    });

    it("잘못된 PIN이면 복원하지 않는다", async () => {
      // 1. PIN으로 암호화 파일 생성
      await createDataFile("encrypted-wrong-pin.json", TEST_PIN);

      // 2. DB에 데이터 추가
      const db = getDatabase();
      const testAccount: Account = createTestAccounts(1)[0];
      await db.accounts.put(testAccount);

      // 3. backupDataFile로 암호화 백업
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
      const importedFile = await openImportedDataFile(
        encryptedJsonString,
        WRONG_PIN,
      );

      // 검증: null 반환
      expect(importedFile).toBeNull();

      // 검증: DB 변경 없음 (원본 데이터 유지)
      const snapshot = await getDatabaseSnapshot("encrypted-wrong-pin.json");
      expect(snapshot.accounts).toHaveLength(1);
      expect(snapshot.accounts[0].title).toBe("Test Account 1");

      // 검증: accountStore 변경 없음 (애초에 데이터가 로드되지 않았으므로 빈 상태 유지)
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(0);

      // 검증: 세션은 변경되지 않음 (기존 세션 유지)
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("encrypted-wrong-pin.json");
      expect(sessionState.cryptoKey).not.toBeNull();
    });

    it("암호화 데이터 변조를 감지한다", async () => {
      // 1. PIN으로 암호화 파일 생성
      await createDataFile("encrypted-tamper.json", TEST_PIN);

      // 2. DB에 데이터 추가
      const db = getDatabase();
      const testAccount: Account = createTestAccounts(1)[0];
      await db.accounts.put(testAccount);

      // 3. backupDataFile로 암호화 백업
      await backupDataFile(
        "encrypted-backup-tamper.json",
        TEST_PIN,
      );

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
      const importedFile = await openImportedDataFile(
        tamperedJsonString,
        TEST_PIN,
      );

      // 검증: 복호화 실패, null 반환
      expect(importedFile).toBeNull();

      // 검증: DB 변경 없음
      const snapshot = await getDatabaseSnapshot("encrypted-tamper.json");
      expect(snapshot.accounts).toHaveLength(1);
      expect(snapshot.accounts[0].title).toBe("Test Account 1");

      // 검증: accountStore 변경 없음 (애초에 데이터가 로드되지 않았으므로 빈 상태 유지)
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(0);
    });
  });
});
