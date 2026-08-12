import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import Dexie from "dexie";
import { fileTable, ACTIVE_FILE_ID, parseFileData } from "@/database/fileTable";
import { getDatabase } from "@/database/db";
import {
  createTestKiyoDataFile,
  createTestEncryptedFile,
  createTestFileData,
  createTestEncryptedFileData,
} from "@/test/fixtures/databaseFixtures";
import type { FileRecord } from "@/database/db";
import type { EncryptedKiyoVaultData } from "@/crypto/encryption";
import { useSessionStore } from "@/store/sessionStore";

// Use real IndexedDB via Dexie (works in Vitest with jsdom)
describe("fileTable - 파일 레코드 관리", () => {
  beforeAll(async () => {
    // Clean up test database
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore
    }
  });

  const resetTestEnvironment = async () => {
    const db = getDatabase();
    await db.files.clear();
    await db.accounts.clear();
    await db.templates.clear();
    await db.settings.clear();
    await db.metadata.clear();
    await useSessionStore.getState().clearSession();
  };

  beforeEach(async () => {
    await resetTestEnvironment();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetTestEnvironment();
    vi.clearAllMocks();
  });

  describe("parseFileData", () => {
    it("평문 JSON 문자열을 KiyoVaultData로 파싱한다", () => {
      const plainData = createTestKiyoDataFile();
      const jsonString = JSON.stringify(plainData);

      const result = parseFileData(jsonString);

      expect(result).toEqual(plainData);
      expect("encrypted" in result).toBe(false);
    });

    it("암호화 JSON 문자열을 EncryptedKiyoVaultData로 파싱한다", () => {
      const encryptedData = createTestEncryptedFile();
      const jsonString = JSON.stringify(encryptedData);

      const result = parseFileData(jsonString);

      expect(result).toEqual(encryptedData);
      expect((result as EncryptedKiyoVaultData).encrypted).toBe(true);
    });

    it("잘못된 JSON이면 에러를 던진다", () => {
      expect(() => parseFileData("{ invalid json }")).toThrow();
    });

    it("빈 객체는 평문으로 파싱된다", () => {
      const result = parseFileData("{}");

      expect(result).toEqual({});
      expect("encrypted" in result).toBe(false);
    });
  });

  describe("getActiveFileRecord", () => {
    it("레코드가 없으면 null을 반환한다", async () => {
      const record = await fileTable.getActiveFileRecord();

      expect(record).toBeNull();
    });

    it("평문 레코드가 있으면 FileRecord를 반환한다", async () => {
      const testRecord = createTestFileData();
      const db = getDatabase();
      await db.files.put(testRecord);

      const record = await fileTable.getActiveFileRecord();

      expect(record).not.toBeNull();
      expect(record!.id).toBe(ACTIVE_FILE_ID);
      expect(record!.fileName).toBe("test.json");
      expect(record!.encrypted).toBe(false);
    });

    it("암호화 레코드가 있으면 FileRecord를 반환한다", async () => {
      const testRecord = createTestEncryptedFileData();
      const db = getDatabase();
      await db.files.put(testRecord);

      const record = await fileTable.getActiveFileRecord();

      expect(record).not.toBeNull();
      expect(record!.id).toBe(ACTIVE_FILE_ID);
      expect(record!.fileName).toBe("test-encrypted.json");
      expect(record!.encrypted).toBe(true);
      expect(record!.salt).toBeDefined();
    });
  });

  describe("getActiveFileInfo", () => {
    it("레코드가 없으면 빈 정보를 반환한다", async () => {
      const info = await fileTable.getActiveFileInfo();

      expect(info.activeFileName).toBeNull();
      expect(info.salt).toBeNull();
      expect(info.encrypted).toBe(false);
      expect(info.fileData).toBeNull();
    });

    it("평문 레코드면 평문 정보와 fileData를 반환한다", async () => {
      const testRecord = createTestFileData();
      const db = getDatabase();
      await db.files.put(testRecord);

      const info = await fileTable.getActiveFileInfo();

      expect(info.activeFileName).toBe("test.json");
      expect(info.salt).toBeNull();
      expect(info.encrypted).toBe(false);
      expect(info.fileData).not.toBeNull();
      expect((info.fileData as any).accounts).toBeDefined();
      expect((info.fileData as any).templates).toBeDefined();
    });

    it("암호화 레코드면 암호화 정보와 salt를 Uint8Array로 반환한다", async () => {
      const testRecord = createTestEncryptedFileData();
      const db = getDatabase();
      await db.files.put(testRecord);

      const info = await fileTable.getActiveFileInfo();

      expect(info.activeFileName).toBe("test-encrypted.json");
      expect(info.encrypted).toBe(true);
      expect(info.salt).toBeInstanceOf(Uint8Array);
      expect(info.salt!.byteLength).toBe(16);
      expect(info.fileData).not.toBeNull();
      expect((info.fileData as EncryptedKiyoVaultData).encrypted).toBe(true);
      expect((info.fileData as EncryptedKiyoVaultData).ciphertext).toBeDefined();
    });

    it("salt가 없으면 null을 반환한다", async () => {
      const record: FileRecord = {
        id: ACTIVE_FILE_ID,
        fileName: "no-salt.json",
        fileData: JSON.stringify(createTestEncryptedFile({ salt: undefined as any })),
        encrypted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const db = getDatabase();
      await db.files.put(record);

      const info = await fileTable.getActiveFileInfo();

      // isEncryptedKiyoVaultData가 salt 필드 체크하므로 false 반환될 수 있음
      // 실제 구현에서는 salt가 없으면 평문으로 처리됨
      expect(info.encrypted).toBe(false);
    });
  });

  describe("upsertFileRecord", () => {
    it("평문 데이터를 저장한다", async () => {
      const plainData = createTestKiyoDataFile({ fileName: "new-file.json" });

      await fileTable.upsertFileRecord("new-file.json", plainData);

      const record = await fileTable.getActiveFileRecord();
      expect(record).not.toBeNull();
      expect(record!.fileName).toBe("new-file.json");
      expect(record!.encrypted).toBe(false);
      expect(record!.salt).toBeUndefined();
    });

    it("암호화 데이터를 저장한다 (salt 포함)", async () => {
      const encryptedData = createTestEncryptedFile({
        salt: "bW9ja1NhbHQxMjM0NTY3OA==",
      });

      await fileTable.upsertFileRecord("encrypted-file.json", encryptedData);

      const record = await fileTable.getActiveFileRecord();
      expect(record).not.toBeNull();
      expect(record!.fileName).toBe("encrypted-file.json");
      expect(record!.encrypted).toBe(true);
      expect(record!.salt).toBe("bW9ja1NhbHQxMjM0NTY3OA==");
    });

    it("동일 ID로 upsert 시 기존 레코드를 덮어쓴다", async () => {
      // 첫 번째 저장
      await fileTable.upsertFileRecord("first.json", createTestKiyoDataFile({ fileName: "first.json" }));

      let record = await fileTable.getActiveFileRecord();
      expect(record!.fileName).toBe("first.json");

      // 두 번째 저장 (같은 ACTIVE_FILE_ID)
      await fileTable.upsertFileRecord("second.json", createTestEncryptedFile());

      record = await fileTable.getActiveFileRecord();
      expect(record!.fileName).toBe("second.json");
      expect(record!.encrypted).toBe(true);
    });

    it("createdAt/updatedAt이 설정된다", async () => {
      const before = Date.now();
      await fileTable.upsertFileRecord("timestamp.json", createTestKiyoDataFile());
      const after = Date.now();

      const record = await fileTable.getActiveFileRecord();
      expect(record!.createdAt).toBeGreaterThanOrEqual(before);
      expect(record!.createdAt).toBeLessThanOrEqual(after);
      expect(record!.updatedAt).toBe(record!.createdAt);
    });
  });

  describe("updateFileRecord", () => {
    it("기존 레코드의 salt와 updatedAt만 갱신한다", async () => {
      await fileTable.upsertFileRecord("update-test.json", createTestKiyoDataFile());
      const originalRecord = await fileTable.getActiveFileRecord();
      const originalCreatedAt = originalRecord!.createdAt;

      // 잠시 대기
      await new Promise((r) => setTimeout(r, 10));

      const newSalt = new Uint8Array(16).fill(42);
      await fileTable.updateFileRecord("update-test.json", newSalt);

      const updatedRecord = await fileTable.getActiveFileRecord();
      expect(updatedRecord).not.toBeNull();
      expect(updatedRecord!.fileName).toBe("update-test.json");
      expect(updatedRecord!.salt).toBeDefined();
      expect(updatedRecord!.updatedAt).toBeGreaterThan(originalCreatedAt);
      // createdAt은 변경되지 않음
      expect(updatedRecord!.createdAt).toBe(originalCreatedAt);
    });

    it("레코드가 없으면 경고만 출력하고 에러를 던지지 않는다", async () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(fileTable.updateFileRecord("nonexistent.json", new Uint8Array(16))).resolves.not.toThrow();

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("No existing file record found"),
      );
      consoleWarn.mockRestore();
    });

    it("salt 없이 호출하면 salt만 undefined로 갱신한다", async () => {
      await fileTable.upsertFileRecord("update-test.json", createTestEncryptedFile());
      const originalRecord = await fileTable.getActiveFileRecord();
      const originalCreatedAt = originalRecord!.createdAt;

      // 잠시 대기하여 updatedAt이 변경되도록 함
      await new Promise((r) => setTimeout(r, 10));

      await fileTable.updateFileRecord("update-test.json");

      const updatedRecord = await fileTable.getActiveFileRecord();
      expect(updatedRecord!.salt).toBeUndefined();
      expect(updatedRecord!.updatedAt).toBeGreaterThan(originalCreatedAt);
    });
  });

  describe("getAllFileNames", () => {
    it("저장된 활성 파일명을 배열로 반환한다 (단일 레코드)", async () => {
      await fileTable.upsertFileRecord("file1.json", createTestKiyoDataFile({ fileName: "file1.json" }));

      const names = await fileTable.getAllFileNames();

      expect(names).toHaveLength(1);
      expect(names).toContain("file1.json");
    });

    it("레코드가 없으면 빈 배열을 반환한다", async () => {
      const names = await fileTable.getAllFileNames();

      expect(names).toEqual([]);
    });
  });

  describe("deleteFileRecord", () => {
    it("활성 파일 레코드를 삭제한다", async () => {
      await fileTable.upsertFileRecord("to-delete.json", createTestKiyoDataFile());
      expect(await fileTable.getActiveFileRecord()).not.toBeNull();

      await fileTable.deleteFileRecord();

      expect(await fileTable.getActiveFileRecord()).toBeNull();
    });

    it("이미 삭제된 상태에서 호출해도 에러가 나지 않는다", async () => {
      await expect(fileTable.deleteFileRecord()).resolves.not.toThrow();
    });
  });

  describe("경계값/예외 상황", () => {
    it("fileData가 유효하지 않은 JSON이면 getActiveFileInfo에서 에러가 전파된다", async () => {
      const record: FileRecord = {
        id: ACTIVE_FILE_ID,
        fileName: "bad.json",
        fileData: "{ not valid json }",
        encrypted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const db = getDatabase();
      await db.files.put(record);

      await expect(fileTable.getActiveFileInfo()).rejects.toThrow();
    });

    it("isEncryptedKiyoVaultData가 false인 데이터는 평문으로 처리된다", async () => {
      // encrypted: true지만 필수 필드가 없는 경우
      const fakeEncrypted = {
        version: 1,
        encrypted: true,
        // salt, iv, ciphertext 누락
      };
      const record: FileRecord = {
        id: ACTIVE_FILE_ID,
        fileName: "fake.json",
        fileData: JSON.stringify(fakeEncrypted),
        encrypted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const db = getDatabase();
      await db.files.put(record);

      const info = await fileTable.getActiveFileInfo();

      // isEncryptedKiyoVaultData가 false 반환하므로 평문으로 처리
      expect(info.encrypted).toBe(false);
    });
  });
});