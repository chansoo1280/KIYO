import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";
import { db, getDatabase } from "@/database/db";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { useMetadataStore } from "@/store/metadataStore";
import {
  createDataFile,
  buildSnapshotFromStores,
  loadVaultToStores,
  saveStoresToFile,
  unlockFile,
  closeDataFile,
  activatePlaintextVault,
} from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import { createTestAccounts } from "@/test/fixtures/accountFixtures";
import { createTestTemplates } from "@/test/fixtures/templateFixtures";
import type { KiyoVaultData } from "@/models/vault";

// JSON 호환 invariant 검증 (Plan-D PR 2 Step 13)
// Hard constraint: KiyoVaultData JSON 스키마는 변경 0
// PR 1 이전 vault 파일이 새 API로도 정확히 파싱되는지 검증

describe("fileStorage - JSON compat invariant (PR 1 hard constraint)", () => {
  beforeEach(async () => {
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore cleanup errors
    }
    await db.open();
    await db.files.clear();
    useSessionStore.setState({
      activeFileName: null,
      cryptoKey: null,
      salt: null,
      initialized: false,
    });
    useAccountStore.setState({ accounts: [] });
    useTemplateStore.setState({ templates: [] });
    useMetadataStore.setState({ metadata: [] });
  });

  afterEach(async () => {
    await db.files.clear();
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore
    }
  });

  it("buildSnapshotFromStores 결과는 KiyoVaultData JSON 스키마를 따른다", () => {
    // Arrange
    useAccountStore.setState({ accounts: createTestAccounts(2) });
    useTemplateStore.setState({ templates: createTestTemplates(2) });

    // Act
    const snapshot = buildSnapshotFromStores("test.json");

    // Assert — hard constraint: 5개 필드 모두 존재
    expect(snapshot).toMatchObject({
      version: 1,
      fileName: "test.json",
      updatedAt: expect.any(Number),
      accounts: expect.any(Array),
      templates: expect.any(Array),
      metadata: expect.any(Array),
    });
    expect(snapshot.accounts.length).toBe(2);
    expect(snapshot.templates.length).toBe(2);
  });

  it("createDataFile (plaintext) → store 메모리 + db.files 검증 (Q16 회귀 수정 반영)", async () => {
    // Act
    const data = await createDataFile("plain-test.json");

    // Assert — createDataFile 결과
    expect(data.fileName).toMatch(/^plain-test(\(\d+\))?\.json$/);
    expect(data.accounts.length).toBeGreaterThanOrEqual(0);
    expect(data.templates.length).toBeGreaterThan(0); // builtin templates

    // session 검증: activeFileName + initialized 모두 set (PR 2 회귀 수정)
    const session = useSessionStore.getState();
    expect(session.activeFileName).toBe(data.fileName);
    expect(session.initialized).toBe(true);
    expect(useTemplateStore.getState().templates.length).toBe(data.templates.length);
    expect(useAccountStore.getState().accounts.length).toBe(data.accounts.length);
  });

  it("saveStoresToFile 후 fileTable.getFileInfo로 round-trip → JSON 스키마 보존", async () => {
    // Arrange
    await createDataFile("roundtrip.json");
    useAccountStore.setState({ accounts: createTestAccounts(3) });
    await saveStoresToFile();

    // Act — 파일 다시 읽기
    const info = await fileTable.getFileInfo("roundtrip.json");

    // Assert — 평문 JSON 파싱 + KiyoVaultData 호환
    expect(info.encrypted).toBe(false);
    expect(info.fileData).toBeTruthy();
    const data = info.fileData as KiyoVaultData;
    expect(data.version).toBe(1);
    expect(data.fileName).toBe("roundtrip.json");
    expect(data.accounts.length).toBe(3);
  });

  it("activatePlaintextVault → store 메모리 정확히 채워짐", async () => {
    // Arrange — 파일 먼저 생성
    await createDataFile("activate-test.json");
    await closeDataFile();
    // 세션 + store reset
    useAccountStore.setState({ accounts: [] });
    useTemplateStore.setState({ templates: [] });
    useSessionStore.setState({ activeFileName: null, initialized: false });

    // Act
    await activatePlaintextVault("activate-test.json");

    // Assert
    const session = useSessionStore.getState();
    expect(session.activeFileName).toBe("activate-test.json");
    expect(session.initialized).toBe(true);
    expect(useTemplateStore.getState().templates.length).toBeGreaterThan(0);
  });

  it("unlockFile (encrypted) → loadVaultToStores → store 메모리 정확히 채워짐", async () => {
    // Arrange — encrypted vault
    await createDataFile("encrypted.json", "1234");
    await closeDataFile();
    useAccountStore.setState({ accounts: [] });
    useTemplateStore.setState({ templates: [] });
    useSessionStore.setState({
      activeFileName: null,
      cryptoKey: null,
      salt: null,
      initialized: false,
    });

    // Act
    const decrypted = await unlockFile("encrypted.json", "1234");

    // Assert
    expect(decrypted).toBeTruthy();
    const session = useSessionStore.getState();
    expect(session.activeFileName).toBe("encrypted.json");
    expect(session.cryptoKey).toBeTruthy();
    expect(session.salt).toBeTruthy();
    expect(session.initialized).toBe(true);
  });

  it("PR 1 이전 형식 평문 JSON → loadVaultToStores → store 정확히 채워짐 (호환성)", () => {
    // Arrange — PR 1 이전 형식 그대로의 정적 fixture
    const legacyJson: KiyoVaultData = {
      version: 1,
      fileName: "legacy.json",
      updatedAt: 1000,
      accounts: createTestAccounts(2),
      templates: createTestTemplates(2),
      metadata: [{ id: 1, version: "1.0.0", createdAt: 1000 }],
    };

    // Act
    loadVaultToStores(legacyJson);

    // Assert — 정적 JSON 그대로 보존
    expect(useAccountStore.getState().accounts.length).toBe(2);
    expect(useTemplateStore.getState().templates.length).toBe(2);
    expect(useMetadataStore.getState().metadata.length).toBe(1);
    expect(useSessionStore.getState().initialized).toBe(true);
  });

  it("closeDataFile → store 3개 clear + session activeFileName=null", async () => {
    // Arrange
    await createDataFile("close-test.json");

    // Act
    await closeDataFile();

    // Assert
    const session = useSessionStore.getState();
    expect(session.activeFileName).toBeNull();
    expect(useAccountStore.getState().accounts).toEqual([]);
    expect(useTemplateStore.getState().templates).toEqual([]);
    expect(useMetadataStore.getState().metadata).toEqual([]);
  });
});

describe("fileTable - files table 단일 진입점 검증 (PR 1)", () => {
  beforeEach(async () => {
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore
    }
    await db.open();
    await db.files.clear();
  });

  afterEach(async () => {
    await db.files.clear();
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore
    }
  });

  it("getDatabase는 Dexie 인스턴스이고 files 테이블만 노출한다", () => {
    const database = getDatabase();
    expect(database).toBe(db);
    // PR 1: accounts/templates/metadata/settings 테이블은 더 이상 없음
    expect((database as unknown as Record<string, unknown>).accounts).toBeUndefined();
    expect((database as unknown as Record<string, unknown>).templates).toBeUndefined();
    expect((database as unknown as Record<string, unknown>).metadata).toBeUndefined();
    expect((database as unknown as Record<string, unknown>).settings).toBeUndefined();
    // files 테이블만 존재
    expect(database.files).toBeDefined();
  });
});