import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import Dexie from "dexie";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { getDatabase } from "@/database/db";
import {
  createDataFile,
  backupDataFile,
  openImportedDataFile,
  changePin,
  unlockFile,
  lockDataFile,
} from "@/database/fileStorage";
import { accountTable } from "@/database/accountTable";
import { templateTable } from "@/database/templateTable";
import { createTestAccounts } from "@/test/fixtures/accountFixtures";
import { createTestTemplates, getBuiltinTemplates } from "@/test/fixtures/templateFixtures";
import { getDefaultMetadata } from "@/test/fixtures/databaseFixtures";
import type { Account, FileMetadata } from "@/models/account";
import type { Template } from "@/models/template";
import type { KiyoVaultData } from "@/models/vault";

type Metadata = FileMetadata;

describe("fileStorage - changePin 전체 invariant", () => {
  beforeAll(async () => {
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore
    }
  });

  const resetTestEnvironment = async () => {
    const db = getDatabase();
    await db.accounts.clear();
    await db.templates.clear();
    await db.settings.clear();
    await db.metadata.clear();
    await db.files.clear();
    await useSessionStore.getState().clearSession();
    await useAccountStore.getState().clearAccounts();
    await useTemplateStore.getState().clearTemplates();
  };

  beforeEach(async () => {
    await resetTestEnvironment();
    vi.clearAllMocks();
    // Mock dev data initialization to avoid extra dev accounts in tests
    vi.spyOn(accountTable, "initializeDevData").mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await resetTestEnvironment();
    vi.clearAllMocks();
  });

  const populateTestData = async () => {
    const accounts = createTestAccounts(2);
    const templates = createTestTemplates(2);
    const metadata = getDefaultMetadata();

    const sessionState = useSessionStore.getState();
    const sessionCryptoKey = sessionState.cryptoKey;

    const db = getDatabase();

    for (const account of accounts) {
      await accountTable.create(account, sessionCryptoKey ?? undefined);
    }
    for (const template of templates) {
      await templateTable.create(template, sessionCryptoKey ?? undefined);
    }
    await db.metadata.bulkPut(metadata);
    await useAccountStore.getState().loadAccounts();
    await useTemplateStore.getState().loadTemplates();
  };

  const verifyDataIntegrity = async (
    importedFile: KiyoVaultData | null,
    expectedAccounts: Account[],
    expectedTemplates: Template[],  // Should include both test templates + builtin templates
    expectedMetadata: Metadata[],
  ) => {
    expect(importedFile).not.toBeNull();
    expect(importedFile!.accounts).toHaveLength(expectedAccounts.length);
    expect(importedFile!.templates).toHaveLength(expectedTemplates.length);
    expect(importedFile!.metadata).toHaveLength(expectedMetadata.length);

    for (const expectedAccount of expectedAccounts) {
      const importedAccount = importedFile!.accounts.find(
        (a) => a.title === expectedAccount.title
      );
      expect(importedAccount).toBeDefined();
      expect(importedAccount!.fields).toEqual(expectedAccount.fields);
    }

    for (const expectedTemplate of expectedTemplates) {
      const importedTemplate = importedFile!.templates.find(
        (t) => t.name === expectedTemplate.name
      );
      expect(importedTemplate).toBeDefined();
      expect(importedTemplate!.fields).toEqual(expectedTemplate.fields);
    }

    for (let i = 0; i < expectedMetadata.length; i++) {
      expect(importedFile!.metadata[i].version).toBe(expectedMetadata[i].version);
    }
  };

  describe("PIN 변경 invariant", () => {
    const TEST_PIN = "1234";
    const NEW_PIN = "5678";

    it("암호화 파일에서 PIN 변경 후 새 PIN으로 unlock 가능 (핵심 invariant)", async () => {
      // 1. PIN으로 암호화 파일 생성
      await createDataFile("change-pin-test.json", TEST_PIN);

      // 2. 데이터 추가 - session에 cryptoKey가 저장되어 있어야 함
      await populateTestData();

      // 3. changePin으로 PIN 변경 (session의 cryptoKey 사용)
      await changePin(NEW_PIN);
      await new Promise(r => setTimeout(r, 10));

      // 4. 세션이 새 키로 업데이트되었는지 확인
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("change-pin-test.json");
      expect(sessionState.cryptoKey).not.toBeNull();
      expect(sessionState.salt).not.toBeNull();

      // 5. 세션 클리어 후 새 PIN으로 unlock
      await lockDataFile();
      const unlocked = await unlockFile("change-pin-test.json", NEW_PIN);

      // 6. 데이터 무결성 확인
      const accounts = createTestAccounts(2);
      const templates = createTestTemplates(2);
      const metadata = getDefaultMetadata();
      // Include builtin templates in expected
      const expectedTemplates = [...templates, ...getBuiltinTemplates()];

      await verifyDataIntegrity(unlocked, accounts, expectedTemplates, metadata);
    });

    it("평문 파일에서 PIN 설정 (암호화 활성화)", async () => {
      // 1. 평문 파일 생성
      await createDataFile("plain-to-encrypted.json", "");

      // 2. 데이터 추가
      await populateTestData();

      // 3. changePin으로 PIN 설정 (암호화)
      await changePin(NEW_PIN);

      // 4. 세션이 암호화 상태로 업데이트되었는지 확인
      const sessionState = useSessionStore.getState();
      expect(sessionState.activeFileName).toBe("plain-to-encrypted.json");
      expect(sessionState.cryptoKey).not.toBeNull();
      expect(sessionState.salt).not.toBeNull();

      // 5. 세션 클리어 후 PIN으로 unlock
      await lockDataFile();
      const unlocked = await unlockFile("plain-to-encrypted.json", NEW_PIN);

      // 6. 데이터 무결성 확인
      const accounts = createTestAccounts(2);
      const templates = createTestTemplates(2);
      const metadata = getDefaultMetadata();
      const expectedTemplates = [...templates, ...getBuiltinTemplates()];

      await verifyDataIntegrity(unlocked, accounts, expectedTemplates, metadata);
    });

    it("잘못된 현재 PIN 상태(세션에 키 없음) → 에러", async () => {
      // 1. 암호화 파일 생성
      await createDataFile("wrong-pin-test.json", TEST_PIN);

      // 2. 데이터 추가
      await populateTestData();

      // 3. 세션에서 cryptoKey만 제거 (lock 상태 시뮬레이션)
      await useSessionStore.getState().clearCryptoKey();

      // 4. changePin 호출 시 에러 발생해야 함
      await expect(changePin(NEW_PIN)).rejects.toThrow();

      // 5. 원본 데이터는 그대로 유지되어야 함 (파일 레코드 존재 확인)
      const fileRecord = await (await import("@/database/fileTable")).fileTable.getActiveFileRecord();
      expect(fileRecord).not.toBeNull();
    });

    it("활성 파일이 없으면 에러", async () => {
      await expect(changePin(NEW_PIN)).rejects.toThrow("활성 데이터 파일이 없습니다");
    });

    it("동일 PIN 재설정 시에도 정상 동작 (새 salt/key 생성)", async () => {
      // 1. 암호화 파일 생성
      await createDataFile("same-pin-test.json", TEST_PIN);
      await populateTestData();

      // 2. 기존 salt 저장
      const sessionBefore = useSessionStore.getState();
      const oldSalt = sessionBefore.salt;

      // 3. 같은 PIN으로 변경
      await changePin(TEST_PIN);
      await new Promise(r => setTimeout(r, 10));

      // 4. 새 salt/key가 생성되었는지 확인
      const sessionAfter = useSessionStore.getState();
      expect(sessionAfter.salt).not.toEqual(oldSalt);
      expect(sessionAfter.cryptoKey).not.toBeNull();

      // 5. 같은 PIN으로 unlock 가능해야 함
      await lockDataFile();
      const unlocked = await unlockFile("same-pin-test.json", TEST_PIN);
      expect(unlocked).not.toBeNull();
    });

    it("다중 PIN 변경 연속 실행", async () => {
      // 1. 암호화 파일 생성
      await createDataFile("multi-change.json", "1111");
      await populateTestData();

      // 2. 연속 PIN 변경 - 각 변경 사이에 약간의 지연으로 트랜잭션 완료 대기
      await changePin("2222");
      await new Promise(r => setTimeout(r, 10));
      await changePin("3333");
      await new Promise(r => setTimeout(r, 10));
      await changePin("4444");

      // 3. 마지막 PIN으로 unlock
      await lockDataFile();
      const unlocked = await unlockFile("multi-change.json", "4444");

      // 4. 데이터 무결성 확인
      const accounts = createTestAccounts(2);
      const templates = createTestTemplates(2);
      const metadata = getDefaultMetadata();
      const expectedTemplates = [...templates, ...getBuiltinTemplates()];

      await verifyDataIntegrity(unlocked, accounts, expectedTemplates, metadata);
    });

    it("PIN 변경 후 backupDataFile로 백업 → 새 PIN으로 복원", async () => {
      // 1. 암호화 파일 생성
      await createDataFile("backup-after-change.json", TEST_PIN);
      await populateTestData();

      // 2. PIN 변경
      await changePin(NEW_PIN);

      // 3. 새 PIN으로 백업
      const backedUp = await backupDataFile("backup-after-change-backup.json", NEW_PIN);
      expect(backedUp.accounts).toHaveLength(2);

      // 4. 백업 데이터로 새 PIN으로 복원
      const backupJson = JSON.stringify(backedUp);
      const restored = await openImportedDataFile(backupJson, NEW_PIN, "restored.json");

      const accounts = createTestAccounts(2);
      const templates = createTestTemplates(2);
      const metadata = getDefaultMetadata();
      const expectedTemplates = [...templates, ...getBuiltinTemplates()];

      await verifyDataIntegrity(restored, accounts, expectedTemplates, metadata);
    });

    // Plan-4 §7.3: PIN 정책 완화 후 changePin 양방향 검증
    it("Plan-4 §7.3-① 숫자 PIN(4자리) → 영문+특수문자 PIN(12자) changePin → 새 PIN으로 unlock", async () => {
      // 1. 4자리 숫자 PIN으로 암호화 파일 생성
      await createDataFile("plan4-mixed-forward.json", "1234");
      await populateTestData();

      // 2. 영문+숫자+특수문자 12자 PIN으로 변경
      const newMixedPin = "MyVault2024!";
      await changePin(newMixedPin);
      await new Promise(r => setTimeout(r, 10));

      // 3. 세션 클리어 후 새 PIN으로 unlock
      await lockDataFile();
      const unlocked = await unlockFile("plan4-mixed-forward.json", newMixedPin);

      // 4. 데이터 무결성 확인
      const accounts = createTestAccounts(2);
      const templates = createTestTemplates(2);
      const metadata = getDefaultMetadata();
      const expectedTemplates = [...templates, ...getBuiltinTemplates()];

      await verifyDataIntegrity(unlocked, accounts, expectedTemplates, metadata);
    });

    it("Plan-4 §7.3-② 영문+특수문자 PIN(12자) → 숫자 PIN(6자리) changePin → 새 PIN으로 unlock", async () => {
      // 1. 영문+숫자+특수문자 12자 PIN으로 암호화 파일 생성
      const startPin = "MyVault2024!";
      await createDataFile("plan4-mixed-backward.json", startPin);
      await populateTestData();

      // 2. 6자리 숫자 PIN으로 변경
      const newNumericPin = "987654";
      await changePin(newNumericPin);
      await new Promise(r => setTimeout(r, 10));

      // 3. 세션 클리어 후 새 PIN으로 unlock
      await lockDataFile();
      const unlocked = await unlockFile("plan4-mixed-backward.json", newNumericPin);

      // 4. 데이터 무결성 확인
      const accounts = createTestAccounts(2);
      const templates = createTestTemplates(2);
      const metadata = getDefaultMetadata();
      const expectedTemplates = [...templates, ...getBuiltinTemplates()];

      await verifyDataIntegrity(unlocked, accounts, expectedTemplates, metadata);
    });
  });
});