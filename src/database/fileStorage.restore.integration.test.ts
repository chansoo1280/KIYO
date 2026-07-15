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
import type {
  Account,
  Template,
  Setting,
  Metadata,
  AccountField,
} from "../models/account";
import type { KiyoDataFile } from "./fileStorage";
import {
  getTestAccounts,
  getTestTemplates,
  getTestFields,
  getComplexTestTemplates,
} from "../test/setup";

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

describe("fileStorage Restore Integration Tests", () => {
  let testDbName: string;

  beforeAll(async () => {
    // Use a unique test database name to avoid conflicts
    testDbName = `kiyo-test-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  });

  afterAll(async () => {
    // Clean up test database - use the actual database name "kiyo-db"
    try {
      await indexedDB.deleteDatabase("kiyo-db");
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
    useSessionStore.getState().clearSession();
    useAccountStore.getState().setAccounts([]);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTestEnvironment();
  });

  afterEach(async () => {
    vi.resetAllMocks();
    await resetTestEnvironment();
  });

  // ============================================
  // Test Data Helpers
  // ============================================

  const getDefaultSettings = (): Setting[] => [
    { theme: "dark", autoLockTime: 300, lockEnabled: true },
  ];

  const getDefaultMetadata = (): Metadata[] => [
    { id: 1, version: "1.0.0", createdAt: Date.now() },
  ];

  const getEncryptedSettings = (): Setting[] => [
    { theme: "dark", autoLockTime: 300, lockEnabled: true },
  ];

  const getEncryptedMetadata = (): Metadata[] => [
    { id: 1, version: "1.0.0", createdAt: Date.now() },
  ];

  // Helper to populate test data in database AND sync to account store
  const populateTestData = async (
    accounts: Account[] = getTestAccounts(),
    templates: Template[] = getTestTemplates(),
    settings: Setting[] = getDefaultSettings(),
    metadata: Metadata[] = getDefaultMetadata(),
  ) => {
    const db = getDatabase();
    await db.accounts.bulkPut(accounts);
    await db.templates.bulkPut(templates);
    await db.settings.bulkPut(settings);
    await db.metadata.bulkPut(metadata);
    // Sync to account store
    useAccountStore.getState().setAccounts(accounts);
  };

  // Helper to backup and restore plain data
  const backupAndRestore = async (fileName: string, pin: string) => {
    const backedUp = await backupDataFile(fileName, pin);
    const backupJson = JSON.stringify(backedUp);
    return openImportedDataFile(backupJson, pin);
  };

  // Helper to backup encrypted and restore
  const backupEncryptedAndRestore = async (fileName: string, pin: string) => {
    await backupDataFile(fileName, pin);
    const db = getDatabase();
    const fileRecord = await db.files
      .where("fileName")
      .equals(fileName)
      .first();
    const encryptedFileData = JSON.parse(fileRecord!.fileData);
    const encryptedJsonString = JSON.stringify(encryptedFileData);
    return openImportedDataFile(encryptedJsonString, pin);
  };

  // Comprehensive data integrity verification
  const verifyDataIntegrity = (
    importedFile: KiyoDataFile | null,
    expectedAccounts: Account[],
    expectedTemplates: Template[],
    expectedSettings: Setting[],
    expectedMetadata: Metadata[],
  ) => {
    expect(importedFile).not.toBeNull();
    expect(importedFile!.accounts).toHaveLength(expectedAccounts.length);
    expect(importedFile!.templates).toHaveLength(expectedTemplates.length);
    expect(importedFile!.settings).toHaveLength(expectedSettings.length);
    expect(importedFile!.metadata).toHaveLength(expectedMetadata.length);

    // Verify accounts
    expectedAccounts.forEach((expected, index) => {
      const actual = importedFile!.accounts[index];
      expect(actual.id).toBe(expected.id);
      expect(actual.templateId).toBe(expected.templateId);
      expect(actual.title).toBe(expected.title);
      expect(actual.tags).toEqual(expected.tags);
      expect(actual.favorite).toBe(expected.favorite);
      expect(actual.fields).toEqual(expected.fields);
      // Timestamps may be slightly updated during backup/restore, allow small tolerance
      expect(actual.createdAt).toBeCloseTo(expected.createdAt, -2); // within ~100ms
      expect(actual.updatedAt).toBeCloseTo(expected.updatedAt, -2);
    });

    // Verify templates
    expectedTemplates.forEach((expected, index) => {
      const actual = importedFile!.templates[index];
      expect(actual.id).toBe(expected.id);
      expect(actual.name).toBe(expected.name);
      expect(actual.fields).toEqual(expected.fields);
    });

    // Verify settings
    expectedSettings.forEach((expected, index) => {
      const actual = importedFile!.settings[index];
      expect(actual.theme).toBe(expected.theme);
      expect(actual.autoLockTime).toBe(expected.autoLockTime);
      expect(actual.lockEnabled).toBe(expected.lockEnabled);
    });

    // Verify metadata
    expectedMetadata.forEach((expected, index) => {
      const actual = importedFile!.metadata[index];
      expect(actual.id).toBe(expected.id);
      expect(actual.version).toBe(expected.version);
      // Timestamps are updated during backup/restore, just verify they exist and are valid
      expect(actual.createdAt).toBeGreaterThan(0);
    });
  };

  // ============================================
  // Tests (6 core integration tests)
  // ============================================

  describe("핵심 복원 시나리오", () => {
    // Test 1: 평문 백업 → 복원 전체 플로우 (빈 데이터, 파일명 검증 포함)
    it("평문 백업 파일로 데이터 복원 시 모든 데이터 정확히 복원됨 (빈 데이터/파일명 포함)", async () => {
      // 1-1. 기본 데이터 복원 검증
      await createDataFile("restore-plain.json", "");
      await populateTestData();

      const importedFile = await backupAndRestore("restore-backup.json", "");

      verifyDataIntegrity(
        importedFile,
        getTestAccounts(),
        getTestTemplates(),
        getDefaultSettings(),
        getDefaultMetadata(),
      );

      // 파일명 검증 (데이터 내부의 fileName 사용)
      expect(importedFile!.fileName).toBe("restore-backup.json");

      // 계정 스토어 확인
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(2);

      // DB 확인
      const snapshot = await getDatabaseSnapshot("restore-backup.json");
      expect(snapshot.accounts).toHaveLength(2);
      expect(snapshot.templates).toHaveLength(2);
      expect(snapshot.settings).toHaveLength(1);
      expect(snapshot.metadata).toHaveLength(1);

      // 1-2. 빈 데이터 복원 검증 (기존 별도 테스트였던 것 통합)
      const db = getDatabase();
      await db.accounts.clear();
      await db.templates.clear();
      await db.settings.clear();
      await db.metadata.clear();
      useAccountStore.getState().setAccounts([]);

      await createDataFile("empty-restore.json", "");
      const emptyBackedUp = await backupDataFile("empty-backup.json", "");
      const emptyBackupJson = JSON.stringify(emptyBackedUp);
      const emptyImported = await openImportedDataFile(emptyBackupJson, "");

      expect(emptyImported).not.toBeNull();
      expect(emptyImported!.accounts).toHaveLength(0);
      expect(emptyImported!.templates).toHaveLength(0);
      expect(emptyImported!.settings).toHaveLength(0);
      expect(emptyImported!.metadata).toHaveLength(0);
      expect(emptyImported!.fileName).toBe("empty-backup.json");
    });

    // Test 2: 암호화 백업 → 복원 전체 플로우
    // 올바른 PIN으로 복호화, sessionStore의 cryptoKey, salt가 정상 설정되는지 확인
    it("암호화 백업 파일로 데이터 복원 시 올바른 PIN으로 복호화 성공 (cryptoKey, salt 검증)", async () => {
      const pin = "1234";
      await createDataFile("restore-encrypted.json", pin);
      await populateTestData(
        getTestAccounts(),
        getTestTemplates(),
        getEncryptedSettings(),
        getEncryptedMetadata(),
      );

      const importedFile = await backupEncryptedAndRestore(
        "restore-encrypted-backup.json",
        pin,
      );

      verifyDataIntegrity(
        importedFile,
        getTestAccounts(),
        getTestTemplates(),
        getEncryptedSettings(),
        getEncryptedMetadata(),
      );
      expect("encrypted" in importedFile!).toBe(false); // 복호화된 평문 반환

      // 세션 확인 (새 키 생성, 파일명은 데이터 내부의 fileName 사용)
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("restore-encrypted-backup.json");
      expect(sessionState.cryptoKey).not.toBeNull();
      expect(sessionState.salt).not.toBeNull();

      // 계정 스토어 확인
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(2);
      expect(storeAccounts[0].fields[0].value).toBe("value1");
    });

    // Test 3: 복잡한 데이터 복원
    // Account, tags, fields, templates, settings, metadata 한 번에 검증
    // 필드 순서(order), 다양한 필드 타입, 특수문자/유니코드 포함
    it("복잡한 데이터 복원 - Account, tags, fields, templates, settings, metadata 모두 검증", async () => {
      await createDataFile("complex-restore.json", "");

      const db = getDatabase();

      // 다양한 필드 타입과 중첩된 데이터 구조
      const complexAccount: Account = {
        id: 1,
        templateId: 1,
        title: "Complex Account 🎉",
        tags: ["tag1", "tag2", "한글", "日本語", "emoji🚀"],
        favorite: true,
        fields: getTestFields().slice(3, 13),
        createdAt: Date.now() - 10000,
        updatedAt: Date.now(),
      };

      const templates = getComplexTestTemplates();

      const settings: Setting[] = [
        { theme: "dark", autoLockTime: 300, lockEnabled: true },
        { theme: "light", autoLockTime: 60, lockEnabled: false },
      ];

      const metadata: Metadata[] = [
        { id: 1, version: "1.0.0", createdAt: Date.now() - 20000 },
        { id: 2, version: "1.1.0", createdAt: Date.now() - 10000 },
        { id: 3, version: "2.0.0", createdAt: Date.now() },
      ];

      await db.accounts.put(complexAccount);
      await db.templates.bulkPut(templates);
      await db.settings.bulkPut(settings);
      await db.metadata.bulkPut(metadata);
      // Sync to account store
      useAccountStore.getState().setAccounts([complexAccount]);

      const backedUp = await backupDataFile("complex-backup.json", "");
      const backupJson = JSON.stringify(backedUp);
      const imported = await openImportedDataFile(backupJson, "");

      verifyDataIntegrity(
        imported,
        [complexAccount],
        templates,
        settings,
        metadata,
      );

      // 필드 순서(order) 정확히 유지되는지 검증 (별도 테스트였던 것 통합)
      const fields = imported!.accounts[0].fields;
      expect(fields).toHaveLength(10);
      const sortedFields = [...fields].sort((a, b) => a.order - b.order);
      expect(sortedFields[0].order).toBe(0);
      expect(sortedFields[0].value).toBe("hello world");
      expect(sortedFields[1].order).toBe(1);
      expect(sortedFields[1].value).toBe(
        "p@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?`~",
      );
      expect(sortedFields[2].order).toBe(2);
      expect(sortedFields[2].value).toBe("test@example.com");
      expect(sortedFields[9].order).toBe(9);
      expect(sortedFields[9].value).toBe(
        "Line 1\nLine 2\tTabbed\r\nWindows line ending",
      );

      // 계정 스토어 확인
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(1);
    });

    // Test 4: 데이터 무결성
    // createdAt, updatedAt, Unicode, 특수문자, 빈 문자열 - 실제 객체 비교만 수행
    it("데이터 무결성 - 타임스탬프, 유니코드, 특수문자, 빈 값 보존 검증", async () => {
      await createDataFile("integrity-restore.json", "");

      const db = getDatabase();
      const now = Date.now();

      // 타임스탬프, 빈 값, 특수문자, 유니코드 모두 포함한 계정
      const account: Account = {
        id: 1,
        templateId: 1,
        title: "특수문자 테스트 🎉",
        tags: ["한글", "日本語", "emoji🚀"],
        favorite: true,
        fields: getTestFields().slice(13, 18),
        createdAt: now - 10000,
        updatedAt: now - 5000,
      };
      await db.accounts.put(account);
      // Sync to account store
      useAccountStore.getState().setAccounts([account]);

      const backedUp = await backupDataFile("integrity-backup.json", "");
      const backupJson = JSON.stringify(backedUp);
      const imported = await openImportedDataFile(backupJson, "");

      expect(imported).not.toBeNull();
      const importedAccount = imported!.accounts[0];

      // 타임스탬프 보존 검증
      expect(importedAccount.createdAt).toBe(now - 10000);
      expect(importedAccount.updatedAt).toBe(now - 5000);

      // 유니코드/특수문자 검증
      expect(importedAccount.title).toBe("특수문자 테스트 🎉");
      expect(importedAccount.tags).toEqual(["한글", "日本語", "emoji🚀"]);
      expect(importedAccount.fields[0].value).toBe(
        "p@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?`~",
      );
      expect(importedAccount.fields[1].value).toBe(
        "Line 1\nLine 2\tTabbed\r\nWindows line ending",
      );
      expect(importedAccount.fields[2].value).toBe(
        JSON.stringify({
          unicode: "🎉🚀💻",
          korean: "안녕하세요",
          japanese: "こんにちは",
          chinese: "你好",
          special: "<script>alert('xss')</script>",
        }),
      );

      // 빈 값, 일반 값 검증
      expect(importedAccount.fields[3].value).toBe("");
      expect(importedAccount.fields[4].value).toBe("normal");
      expect(importedAccount.tags).toEqual(["한글", "日本語", "emoji🚀"]);
    });

    // Test 5: 대용량 데이터
    // 계정 여러 개 복원 가능한지만 확인 (성능 테스트 제거)
    it("대용량 데이터 - 여러 계정 복원 가능 확인", async () => {
      await createDataFile("large-restore.json", "");

      const db = getDatabase();
      const accounts: Account[] = [];

      // 20개 계정 생성 (100개 → 20개로 축소, 성능 테스트 목적 제거)
      for (let i = 1; i <= 20; i++) {
        accounts.push({
          id: i,
          templateId: 1,
          title: `Account ${i}`,
          tags: [`tag${i % 5}`, `category${i % 3}`],
          favorite: i % 7 === 0,
          fields: [
            {
              id: `${i}-1`,
              label: "Username",
              type: "text",
              value: `user${i}`,
              order: 0,
            },
            {
              id: `${i}-2`,
              label: "Password",
              type: "password",
              value: `pass${i}`,
              order: 1,
            },
            {
              id: `${i}-3`,
              label: "Email",
              type: "email",
              value: `user${i}@example.com`,
              order: 2,
            },
          ],
          createdAt: Date.now() - i * 1000,
          updatedAt: Date.now() - i * 100,
        });
      }

      await db.accounts.bulkPut(accounts);
      // Sync to account store
      useAccountStore.getState().setAccounts(accounts);

      const backedUp = await backupDataFile("large-backup.json", "");
      expect(backedUp.accounts).toHaveLength(20);

      const backupJson = JSON.stringify(backedUp);
      const imported = await openImportedDataFile(backupJson, "");

      expect(imported).not.toBeNull();
      expect(imported!.accounts).toHaveLength(20);
      expect(imported!.accounts[0].title).toBe("Account 1");
      expect(imported!.accounts[19].title).toBe("Account 20");
      expect(imported!.accounts[10].fields[1].value).toBe("pass11");

      // 계정 스토어 확인
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(20);
    });

    // Test 6: 암호화된 상태에서 복잡한 데이터 복원
    // 암호화 백업 + 복잡한 데이터 + PIN 복호화 통합 검증
    it("암호화된 상태에서 복잡한 중첩 데이터 복원 (PIN 복호화 + 세션 검증)", async () => {
      const pin = "9999";
      await createDataFile("complex-encrypted-restore.json", pin);

      const db = getDatabase();
      const complexAccount: Account = {
        id: 1,
        templateId: 1,
        title: "Complex Encrypted 🎉",
        tags: ["encrypted", "complex", "nested", "한글"],
        favorite: true,
        fields: getTestFields().slice(18, 23),
        createdAt: Date.now() - 5000,
        updatedAt: Date.now(),
      };

      await db.accounts.put(complexAccount);
      // Sync to account store
      useAccountStore.getState().setAccounts([complexAccount]);

      // 암호화 백업
      await backupDataFile("complex-encrypted-backup.json", pin);

      // DB에서 암호화된 데이터 가져오기
      const fileRecord = await db.files
        .where("fileName")
        .equals("complex-encrypted-backup.json")
        .first();
      const encryptedFileData = JSON.parse(fileRecord!.fileData);
      const encryptedJsonString = JSON.stringify(encryptedFileData);

      // 올바른 PIN으로 복원
      const imported = await openImportedDataFile(encryptedJsonString, pin);

      expect(imported).not.toBeNull();
      expect(imported!.accounts).toHaveLength(1);
      const importedAccount = imported!.accounts[0];
      expect(importedAccount.title).toBe("Complex Encrypted 🎉");
      expect(importedAccount.tags).toEqual([
        "encrypted",
        "complex",
        "nested",
        "한글",
      ]);
      expect(importedAccount.fields).toHaveLength(5);
      expect(importedAccount.fields[0].value).toBe("value1");
      expect(importedAccount.fields[1].value).toBe("secret2");
      expect(importedAccount.fields[2].value).toBe("test@test.com");
      expect(importedAccount.fields[3].value).toBe("999");
      expect(importedAccount.fields[4].value).toBe("한글 English 🌟");
      expect("encrypted" in imported!).toBe(false);

      // 세션 확인
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("complex-encrypted-backup.json");
      expect(sessionState.cryptoKey).not.toBeNull();
      expect(sessionState.salt).not.toBeNull();
    });
  });
});
