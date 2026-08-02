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
import { getDatabaseSnapshot, getDatabase} from "@/database/db";
import {
  createDataFile,
  backupDataFile,
  openImportedDataFile,
} from "@/database/fileStorage";
import type { Account, FileMetadata } from "@/models/account";
import { createTestAccounts } from "@/test/fixtures/accountFixtures";
import { createTestTemplates } from "@/test/fixtures/templateFixtures";
import type { Template } from "@/models/template";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import { createTestMetadata } from "@/test/fixtures/databaseFixtures";
import Dexie from "dexie";

type Metadata = FileMetadata;


// Use real IndexedDB via Dexie (works in Vitest with jsdom)

describe("fileStorage Lifecycle Intergration Tests", () => {
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

  // afterEach removed - beforeEach already fully resets

  describe("평문 파일 라이프사이클", () => {
    it("평문 데이터 파일을 생성한다", async () => {
      // 1. createDataFile로 평문 파일 생성
      const fileName = "plain-lifecycle.json";
      const createdFile = await createDataFile(fileName, "");

      expect(createdFile).toBeDefined();
      expect(createdFile.fileName).toBe("plain-lifecycle.json");
      expect(createdFile.version).toBe(1);
      expect("encrypted" in createdFile).toBe(false);
      expect(createdFile.accounts).toEqual([]);
      // 내장 템플릿 6개가 자동 시드됨
      expect(createdFile.templates).toHaveLength(6);
      expect(createdFile.metadata).toHaveLength(1);
      expect(createdFile.metadata[0]).toEqual(expect.objectContaining({ id: 1, version: "1.0.0" }));

      // 세션에 파일명이 저장되었는지 확인
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("plain-lifecycle.json");
      expect(sessionState.cryptoKey).toBeNull();
      expect(sessionState.salt).toBeNull();
    });

    it("현재 DB 데이터를 평문 파일로 백업한다", async () => {
      // 1. 평문 파일 생성
      await createDataFile("backup-source.json", "");

      // 2. 데이터 추가 (계정, 템플릿, 설정, 메타데이터)
      const db = getDatabase();
      const sessionAfterCreate = useSessionStore.getState();
      const sessionCryptoKey = sessionAfterCreate.cryptoKey;

      const testAccount: Account = createTestAccounts(1)[0];
      await accountTable.create(testAccount, sessionCryptoKey ?? undefined);

      const testTemplate: Template = createTestTemplates(1)[0];
      await templateTable.create(testTemplate, sessionCryptoKey ?? undefined);

      const metadata: FileMetadata[] = [createTestMetadata()];
      await db.metadata.bulkPut(metadata);

      // 3. backupDataFile로 평문 백업
      const backedUpFile = await backupDataFile("plain-backup.json", "");

      expect(backedUpFile).toBeDefined();
      expect(backedUpFile.fileName).toBe("plain-backup.json");
      expect("encrypted" in backedUpFile).toBe(false);
      expect(backedUpFile.accounts).toHaveLength(1);
      expect(backedUpFile.accounts[0].title).toBe("Test Account 1");
      // 내장 템플릿 6개 + 테스트 템플릿 1개 = 7개
      expect(backedUpFile.templates).toHaveLength(7);
      expect(backedUpFile.metadata).toHaveLength(1);

      // 백업 파일은 세션을 변경하지 않음 (shouldSetActiveFile=false)
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("backup-source.json");
    });

    it("평문 백업 파일을 다시 가져온다", async () => {
      // 1. 평문 파일 생성 및 데이터 추가
      await createDataFile("import-source.json", "");

      const sessionAfterCreate = useSessionStore.getState();
      const sessionCryptoKey = sessionAfterCreate.cryptoKey;
      const testAccount: Account = createTestAccounts(1)[0];
      await accountTable.create(testAccount, sessionCryptoKey ?? undefined);

      const testTemplate: Template = createTestTemplates(1)[0];
      await templateTable.create(testTemplate, sessionCryptoKey ?? undefined);

      // 2. 평문 백업
      const backedUpFile = await backupDataFile("plain-backup.json", "");

      // 3. 백업된 데이터를 JSON 문자열로 변환
      const backupJsonString = JSON.stringify(backedUpFile);

      // 4. openImportedDataFile로 가져오기 (PIN 없이 평문 파일로)
      // 파일명은 백업 데이터의 fileName 속성에서 가져옴
      const importedFile = await openImportedDataFile(backupJsonString, "", backedUpFile.fileName);

      expect(importedFile).not.toBeNull();
      expect(importedFile!.fileName).toBe("plain-backup.json");
      expect(importedFile!.version).toBe(1);
      expect("encrypted" in importedFile!).toBe(false);
      expect(importedFile!.accounts).toHaveLength(1);
      expect(importedFile!.accounts[0].title).toBe("Test Account 1");
      // 내장 템플릿 6개 + 테스트 템플릿 1개 = 7개
      expect(importedFile!.templates).toHaveLength(7);

      // 세션이 업데이트되었는지 확인 (파일명은 데이터 내부의 fileName 사용)
      const updatedSession = useSessionStore.getState();
      expect(updatedSession.activeFileName).toBe("plain-backup.json");
      expect(updatedSession.cryptoKey).toBeNull();
      expect(updatedSession.salt).toBeNull();

      // 계정 스토어도 업데이트되었는지 확인
      const accounts = useAccountStore.getState().accounts;
      expect(accounts).toHaveLength(1);
      expect(accounts[0].title).toBe("Test Account 1");

      // DB에도 데이터가 저장되었는지 확인
      const session = useSessionStore.getState();
      const snapshot = await getDatabaseSnapshot("plain-backup.json", session.cryptoKey ?? undefined);
      expect(snapshot.accounts).toHaveLength(1);
      expect(snapshot.accounts[0].title).toBe("Test Account 1");
    });

    it("파일 lifecycle 전체 흐름이 정상 동작한다", async () => {
      // 1. createDataFile로 평문 파일 생성
      const createdFile = await createDataFile("lifecycle-test.json", "");
      expect(createdFile.fileName).toBe("lifecycle-test.json");
      expect("encrypted" in createdFile).toBe(false);

      // 세션 확인
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("lifecycle-test.json");
      expect(sessionState.cryptoKey).toBeNull();

      // 2. 데이터 추가 (계정, 템플릿, 메타데이터 모두) - accountTable, templateTable 사용
      const sessionAfterCreate = useSessionStore.getState();
      const sessionCryptoKey = sessionAfterCreate.cryptoKey;

      const accounts: Account[] = createTestAccounts(2);
      for (const account of accounts) {
        await accountTable.create(account, sessionCryptoKey ?? undefined);
      }

      const templates: Template[] = createTestTemplates(2);
      for (const template of templates) {
        await templateTable.create(template, sessionCryptoKey ?? undefined);
      }

      const db = getDatabase();
      const metadata: Metadata[] = [createTestMetadata()];
      await db.metadata.bulkPut(metadata);

      // 3. backupDataFile로 평문 백업
      const backedUpFile = await backupDataFile("lifecycle-backup.json", "");

      expect(backedUpFile.accounts).toHaveLength(2);
      // 내장 템플릿 6개 + 테스트 템플릿 2개 = 8개
      expect(backedUpFile.templates).toHaveLength(8);
      expect(backedUpFile.metadata).toHaveLength(1);
      expect("encrypted" in backedUpFile).toBe(false);

      // 백업은 세션 변경 안 함
      expect(sessionState.activeFileName).toBe("lifecycle-test.json");

      // 4. 백업 데이터를 JSON 문자열로 변환
      const backupJsonString = JSON.stringify(backedUpFile);

      // 5. openImportedDataFile로 가져오기
      const importedFile = await openImportedDataFile(backupJsonString, "", backedUpFile.fileName);

      expect(importedFile).not.toBeNull();
      expect(importedFile!.fileName).toBe("lifecycle-backup.json");
      expect(importedFile!.accounts).toHaveLength(2);
      // 계정 순서는 DB 정렬(updatedAt)에 의존하므로 순서 무관하게 검증
      const accountTitles = importedFile!.accounts.map((a) => a.title).sort();
      expect(accountTitles).toEqual(["Test Account 1", "Test Account 2"]);
      // 내장 템플릿 6개 + 테스트 템플릿 2개 = 8개
      expect(importedFile!.templates).toHaveLength(8);
      expect(importedFile!.metadata).toHaveLength(1);
      expect("encrypted" in importedFile!).toBe(false);

      // 세션 업데이트 확인
      const updatedSession = useSessionStore.getState();
      expect(updatedSession.activeFileName).toBe("lifecycle-backup.json");
      expect(updatedSession.cryptoKey).toBeNull();
      expect(updatedSession.salt).toBeNull();

      // 계정 스토어 확인
      const storeAccounts = useAccountStore.getState().accounts;
      expect(storeAccounts).toHaveLength(2);
      // 계정 순서는 DB 정렬(updatedAt)에 의존하므로 순서 무관하게 검증
      const storeAccountTitles = storeAccounts.map((a) => a.title).sort();
      expect(storeAccountTitles).toEqual(["Test Account 1", "Test Account 2"]);

      // DB 확인
      const session = useSessionStore.getState();
      const snapshot = await getDatabaseSnapshot("lifecycle-backup.json", session.cryptoKey ?? undefined);
      expect(snapshot.accounts).toHaveLength(2);
      // 내장 템플릿 6개 + 테스트 템플릿 2개 = 8개
      expect(snapshot.templates).toHaveLength(8);
      expect(snapshot.metadata).toHaveLength(1);
    });
  });
  describe("파일명 정규화 검증", () => {
    it("createDataFile, backupDataFile, openImportedDataFile 모두 파일명 정규화 적용", async () => {
      // createDataFile
      const created = await createDataFile("  test file  ", "");
      expect(created.fileName).toBe("test file.json");

      // backupDataFile
      const backedUp = await backupDataFile("  backup file  ", "");
      expect(backedUp.fileName).toBe("backup file.json");

      // openImportedDataFile - 파일명은 데이터 내부에서 가져옴
      const backupJson = JSON.stringify(backedUp);
      const imported = await openImportedDataFile(backupJson, "", backedUp.fileName);
      expect(imported!.fileName).toBe("backup file.json");
    });

    it("확장자가 없는 경우 .json 자동 추가", async () => {
      const created = await createDataFile("noext", "");
      expect(created.fileName).toBe("noext.json");

      const backedUp = await backupDataFile("noext-backup", "");
      expect(backedUp.fileName).toBe("noext-backup.json");

      const backupJson = JSON.stringify(backedUp);
      const imported = await openImportedDataFile(backupJson, "", backedUp.fileName);
      expect(imported!.fileName).toBe("noext-backup.json");
    });

    it("이미 .json이 있는 경우 중복 추가 안 함", async () => {
      const created = await createDataFile("already.json", "");
      expect(created.fileName).toBe("already.json");

      const backedUp = await backupDataFile("already-backup.json", "");
      expect(backedUp.fileName).toBe("already-backup.json");
    });
  });
});
