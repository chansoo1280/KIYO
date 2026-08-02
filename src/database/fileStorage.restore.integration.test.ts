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
import { getDatabase, getDatabaseSnapshot } from "@/database/db";
import {
  createDataFile,
  backupDataFile,
  openImportedDataFile,
} from "@/database/fileStorage";
import type { Account, FileMetadata } from "@/models/account";
import type { Template } from "@/models/template";
import type { KiyoVaultData } from "@/models/vault";
import {
  createTestAccounts,
  createComplexAccount,
} from "@/test/fixtures/accountFixtures";
import {
  createTestTemplates,
  createComplexTestTemplate,
  getBuiltinTemplates,
} from "@/test/fixtures/templateFixtures";
import { createCryptoKey, encryptData } from "@/crypto/encryption";
import {
  getDefaultMetadata,
} from "@/test/helpers/databaseTestHelpers";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import Dexie from "dexie";
import { useTemplateStore } from "@/store/templateStore";

type Metadata = FileMetadata;

// Use real IndexedDB via Dexie (works in Vitest with jsdom)

describe("fileStorage Restore Integration Tests", () => {
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
      useAccountStore.getState().setAccounts([]);
    };
  
    beforeEach(async () => {
      vi.spyOn(accountTable, "initializeDevData").mockResolvedValue(undefined);
    });
  
    afterEach(async () => {
      await resetTestEnvironment();
      vi.clearAllMocks();
    });
  // afterEach removed - beforeEach handles reset

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

  // Helper to backup and restore plain data
  const backupAndRestore = async (fileName: string, pin: string) => {
    const backedUp = await backupDataFile(fileName, pin);
    const backupJson = JSON.stringify(backedUp);
    return openImportedDataFile(backupJson, pin, fileName);
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
    console.log("backupWithPinAndRestoreWithPin" + snapshot.templates.map(t => t.name));
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
      console.log("Verifying template:", expectedTemplate.name);
      console.log("Imported templates:", importedFile!.templates.map(t => t.name));
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

  describe("평문 데이터 복원", () => {
    it("평문 데이터 파일을 백업하고 복원한다", async () => {
      await createDataFile("plain-restore.json", "");
      const accounts = createTestAccounts(2);
      const templates = createTestTemplates(2);
      const metadata = getDefaultMetadata();
      await populateTestData(accounts, templates, metadata);

      const imported = await backupAndRestore("plain-restore.json", "");

      // 내장 템플릿 6개 + 사용자 템플릿 2개 = 8개
      const expectedTemplates = [...templates, ...getBuiltinTemplates()];
      verifyDataIntegrity(imported, accounts, expectedTemplates, metadata);

      // Account store should be updated
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(2);
    });

    it("평문 데이터 복원 시 세션이 업데이트된다", async () => {
      await createDataFile("session-update.json", "");
      await populateTestData();

      const imported = await backupAndRestore("session-update.json", "");

      expect(imported).not.toBeNull();
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("session-update.json");
      expect(sessionState.cryptoKey).toBeNull();
      expect(sessionState.salt).toBeNull();
    });
  });

  describe("복잡한 계정 데이터 복원", () => {
    it("필드 10개가 있는 복잡한 계정 복원", async () => {
      await createDataFile("complex-restore.json", "");
      const complexAccount = createComplexAccount();
      const templates = [createComplexTestTemplate()];
      const metadata: Metadata[] = [
        { id: 1, version: "1.0.0", createdAt: Date.now() - 20000 },
        { id: 2, version: "1.1.0", createdAt: Date.now() - 10000 },
        { id: 3, version: "2.0.0", createdAt: Date.now() },
      ];

      const sessionAfterCreate = useSessionStore.getState();
      const sessionCryptoKey = sessionAfterCreate.cryptoKey;
      await accountTable.restore(complexAccount, sessionCryptoKey ?? undefined);
      for (const template of templates) {
        await templateTable.restore(template, sessionCryptoKey ?? undefined);
      }
      const db = getDatabase();
      await db.metadata.bulkPut(metadata);
      // Sync to account store
      useAccountStore.getState().setAccounts([complexAccount]);

      const backedUp = await backupDataFile("complex-backup.json", "");
      const backupJson = JSON.stringify(backedUp);
      const imported = await openImportedDataFile(
        backupJson,
        "",
        "complex-backup.json",
      );

      // 내장 템플릿 6개 + 테스트 템플릿 1개 = 7개
      const expectedTemplates = [
        ...templates,
        ...getBuiltinTemplates(),
      ];

      verifyDataIntegrity(
        imported,
        [complexAccount],
        expectedTemplates,
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
    });
  });

  describe("암호화 데이터 복원", () => {
    const TEST_PIN = "1234";

    it("PIN으로 암호화된 데이터를 백업하고 올바른 PIN으로 복원한다", async () => {
      await createDataFile("encrypted-restore.json", TEST_PIN);
      const {cryptoKey}  = await useSessionStore.getState()
      console.log(cryptoKey + "templateTable.getAll"+ (await templateTable.getAll(cryptoKey||undefined)).map(t => t.name));
      await populateTestData();
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

    it("잘못된 PIN으로 암호화 데이터 복원 시 에러 발생", async () => {
      await createDataFile("wrong-pin-restore.json", TEST_PIN);
      await populateTestData();

      await expect(
        backupWithPinAndRestoreWithPin("wrong-pin-restore.json", TEST_PIN, "wrong-pin"),
      ).rejects.toThrow("PIN 불일치");

      // 원본 데이터가 보존되는지 확인
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("wrong-pin-restore.json");
    });
  });

  describe("데이터 무결성 검증", () => {
    it("메타데이터 버전이 정확히 복원된다", async () => {
      await createDataFile("metadata-restore.json", "");
      const metadata: Metadata[] = [
        { id: 1, version: "1.0.0", createdAt: Date.now() - 30000 },
        { id: 2, version: "1.5.0", createdAt: Date.now() - 20000 },
        { id: 3, version: "2.0.0", createdAt: Date.now() - 10000 },
      ];
      await populateTestData([], [], metadata);

      const imported = await backupAndRestore("metadata-restore.json", "");

      expect(imported).not.toBeNull();
      expect(imported!.metadata).toHaveLength(3);
      expect(imported!.metadata[0].version).toBe("1.0.0");
      expect(imported!.metadata[1].version).toBe("1.5.0");
      expect(imported!.metadata[2].version).toBe("2.0.0");
    });

    it("내장 템플릿 6개가 항상 복원에 포함된다", async () => {
      await createDataFile("builtin-templates.json", "");
      await populateTestData([], [], []);

      const imported = await backupAndRestore("builtin-templates.json", "");

      expect(imported).not.toBeNull();
      expect(imported!.templates).toHaveLength(6);
      const builtinNames = imported!.templates.map((t) => t.name);
      expect(builtinNames).toEqual([
        "로그인",
        "API 키",
        "신용/체크카드",
        "은행 계좌",
        "Wi-Fi",
        "보안 메모",
      ]);
    });

    it("사용자 템플릿과 내장 템플릿이 모두 복원된다", async () => {
      await createDataFile("mixed-templates.json", "");
      const userTemplates = createTestTemplates(3);
      await populateTestData([], userTemplates, []);

      const imported = await backupAndRestore("mixed-templates.json", "");

      expect(imported).not.toBeNull();
      // 내장 템플릿 6개 + 사용자 템플릿 3개 = 9개
      expect(imported!.templates).toHaveLength(9);
      const userTemplateNames = userTemplates.map((t) => t.name);
      for (const name of userTemplateNames) {
        expect(imported!.templates.find((t) => t.name === name)).toBeDefined();
      }
    });
  });

  describe("에러 처리", () => {
    it("잘못된 JSON 형식 복원 시 에러", async () => {
      await expect(
        openImportedDataFile("invalid json{", "", "invalid.json"),
      ).rejects.toThrow("JSON 파싱 실패");
    });

    it("키요 파일이 아닌 JSON 복원 시 에러", async () => {
      await expect(
        openImportedDataFile(
          JSON.stringify({ random: "data" }),
          "",
          "invalid.json",
        ),
      ).rejects.toThrow("is not KiyoFile");
    });
  });
});