import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import Dexie from "dexie";
import { fileTable, parseFileData } from "@/database/fileTable";
import { getDatabase } from "@/database/db";
import {
  createTestKiyoDataFile,
  createTestEncryptedFile,
  createTestFileData,
  createTestEncryptedFileData,
} from "@/test/fixtures/databaseFixtures";
import type { FileRecord } from "@/database/db";
import type { KiyoVaultData, EncryptedKiyoVaultData } from "@/models/vault";
import { useSessionStore } from "@/store/sessionStore";

// Use real IndexedDB via Dexie (works in Vitest with jsdom)
describe("fileTable - 파일 레코드 관리 (v14 multi-row)", () => {
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

  describe("getFileRecord", () => {
    it("레코드가 없으면 null을 반환한다", async () => {
      const record = await fileTable.getFileRecord("nonexistent.json");

      expect(record).toBeNull();
    });

    it("평문 레코드가 있으면 FileRecord를 반환한다 (id = fileName)", async () => {
      const testRecord: FileRecord = {
        ...createTestFileData(),
        id: "test.json",
        fileName: "test.json",
      };
      const db = getDatabase();
      await db.files.put(testRecord);

      const record = await fileTable.getFileRecord("test.json");

      expect(record).not.toBeNull();
      expect(record!.id).toBe("test.json");
      expect(record!.fileName).toBe("test.json");
      expect(record!.encrypted).toBe(false);
    });

    it("암호화 레코드가 있으면 FileRecord를 반환한다", async () => {
      const testRecord: FileRecord = {
        ...createTestEncryptedFileData(),
        id: "test-encrypted.json",
        fileName: "test-encrypted.json",
      };
      const db = getDatabase();
      await db.files.put(testRecord);

      const record = await fileTable.getFileRecord("test-encrypted.json");

      expect(record).not.toBeNull();
      expect(record!.id).toBe("test-encrypted.json");
      expect(record!.fileName).toBe("test-encrypted.json");
      expect(record!.encrypted).toBe(true);
      expect(record!.salt).toBeDefined();
    });
  });

  describe("getFileInfo", () => {
    it("레코드가 없으면 빈 정보를 반환한다", async () => {
      const info = await fileTable.getFileInfo("nonexistent.json");

      expect(info.activeFileName).toBeNull();
      expect(info.salt).toBeNull();
      expect(info.encrypted).toBe(false);
      expect(info.fileData).toBeNull();
    });

    it("평문 레코드면 평문 정보와 fileData를 반환한다", async () => {
      const testRecord: FileRecord = {
        ...createTestFileData(),
        id: "test.json",
        fileName: "test.json",
      };
      const db = getDatabase();
      await db.files.put(testRecord);

      const info = await fileTable.getFileInfo("test.json");

      expect(info.activeFileName).toBe("test.json");
      expect(info.salt).toBeNull();
      expect(info.encrypted).toBe(false);
      expect(info.fileData).not.toBeNull();
      const plainData = info.fileData as KiyoVaultData;
      expect(plainData.accounts).toBeDefined();
      expect(plainData.templates).toBeDefined();
    });

    it("암호화 레코드면 암호화 정보와 salt를 Uint8Array로 반환한다", async () => {
      const testRecord: FileRecord = {
        ...createTestEncryptedFileData(),
        id: "test-encrypted.json",
        fileName: "test-encrypted.json",
      };
      const db = getDatabase();
      await db.files.put(testRecord);

      const info = await fileTable.getFileInfo("test-encrypted.json");

      expect(info.activeFileName).toBe("test-encrypted.json");
      expect(info.encrypted).toBe(true);
      expect(info.salt).toBeInstanceOf(Uint8Array);
      expect(info.salt!.byteLength).toBe(16);
      expect(info.fileData).not.toBeNull();
      expect((info.fileData as EncryptedKiyoVaultData).encrypted).toBe(true);
      expect((info.fileData as EncryptedKiyoVaultData).ciphertext).toBeDefined();
    });
  });

  describe("upsertFileRecord", () => {
    it("평문 데이터를 저장한다 (id = fileName)", async () => {
      const plainData = createTestKiyoDataFile({ fileName: "new-file.json" });

      await fileTable.upsertFileRecord("new-file.json", plainData);

      const record = await fileTable.getFileRecord("new-file.json");
      expect(record).not.toBeNull();
      expect(record!.id).toBe("new-file.json");
      expect(record!.fileName).toBe("new-file.json");
      expect(record!.encrypted).toBe(false);
      expect(record!.salt).toBeUndefined();
    });

    it("암호화 데이터를 저장한다 (salt 포함)", async () => {
      const encryptedData = createTestEncryptedFile({
        salt: "bW9ja1NhbHQxMjM0NTY3OA==",
      });

      await fileTable.upsertFileRecord("encrypted-file.json", encryptedData);

      const record = await fileTable.getFileRecord("encrypted-file.json");
      expect(record).not.toBeNull();
      expect(record!.id).toBe("encrypted-file.json");
      expect(record!.fileName).toBe("encrypted-file.json");
      expect(record!.encrypted).toBe(true);
      expect(record!.salt).toBe("bW9ja1NhbHQxMjM0NTY3OA==");
    });

    it("동일 fileName으로 재호출 시 같은 row를 갱신 (덮어쓰기)", async () => {
      await fileTable.upsertFileRecord("first.json", createTestKiyoDataFile({ fileName: "first.json" }));
      const before = await fileTable.getFileRecord("first.json");
      expect(before!.fileName).toBe("first.json");
      expect(before!.encrypted).toBe(false);

      await fileTable.upsertFileRecord("first.json", createTestEncryptedFile());

      const after = await fileTable.getFileRecord("first.json");
      expect(after!.fileName).toBe("first.json");
      expect(after!.encrypted).toBe(true);
      // row 1개 (덮어쓰기)
      const all = await fileTable.getAllFiles();
      expect(all).toHaveLength(1);
    });

    it("다른 fileName은 별도 row로 저장된다 (multi-row)", async () => {
      await fileTable.upsertFileRecord("a.json", createTestKiyoDataFile({ fileName: "a.json" }));
      await fileTable.upsertFileRecord("b.json", createTestKiyoDataFile({ fileName: "b.json" }));
      await fileTable.upsertFileRecord("c.json", createTestKiyoDataFile({ fileName: "c.json" }));

      const all = await fileTable.getAllFiles();
      expect(all).toHaveLength(3);
      const names = all.map((f) => f.fileName).sort();
      expect(names).toEqual(["a.json", "b.json", "c.json"]);
    });

    it("createdAt은 첫 저장 시 설정되고 갱신 시 보존된다", async () => {
      const before = Date.now();
      await fileTable.upsertFileRecord("timestamp.json", createTestKiyoDataFile());
      const after = Date.now();

      const initial = await fileTable.getFileRecord("timestamp.json");
      expect(initial!.createdAt).toBeGreaterThanOrEqual(before);
      expect(initial!.createdAt).toBeLessThanOrEqual(after);
      expect(initial!.updatedAt).toBe(initial!.createdAt);

      // 잠시 대기 후 갱신
      await new Promise((r) => setTimeout(r, 10));
      await fileTable.upsertFileRecord("timestamp.json", createTestKiyoDataFile());
      const updated = await fileTable.getFileRecord("timestamp.json");
      expect(updated!.createdAt).toBe(initial!.createdAt); // 보존
      expect(updated!.updatedAt).toBeGreaterThan(initial!.createdAt); // 갱신
    });
  });

  describe("updateFileRecord", () => {
    it("기존 레코드의 salt와 updatedAt만 갱신한다 (id = fileName)", async () => {
      await fileTable.upsertFileRecord("update-test.json", createTestKiyoDataFile());
      const originalRecord = await fileTable.getFileRecord("update-test.json");
      const originalCreatedAt = originalRecord!.createdAt;

      await new Promise((r) => setTimeout(r, 10));

      const newSalt = new Uint8Array(16).fill(42);
      await fileTable.updateFileRecord("update-test.json", newSalt);

      const updatedRecord = await fileTable.getFileRecord("update-test.json");
      expect(updatedRecord).not.toBeNull();
      expect(updatedRecord!.fileName).toBe("update-test.json");
      expect(updatedRecord!.salt).toBeDefined();
      expect(updatedRecord!.updatedAt).toBeGreaterThan(originalCreatedAt);
      expect(updatedRecord!.createdAt).toBe(originalCreatedAt);
    });

    it("레코드가 없으면 경고만 출력하고 에러를 던지지 않는다", async () => {
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(
        fileTable.updateFileRecord("nonexistent.json", new Uint8Array(16)),
      ).resolves.not.toThrow();

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("No existing file record found"),
      );
      consoleWarn.mockRestore();
    });
  });

  describe("getAllFiles / getAllFileNames", () => {
    it("N-row 시 모든 fileName을 반환한다", async () => {
      await fileTable.upsertFileRecord("file1.json", createTestKiyoDataFile({ fileName: "file1.json" }));
      await fileTable.upsertFileRecord("file2.json", createTestKiyoDataFile({ fileName: "file2.json" }));
      await fileTable.upsertFileRecord("file3.json", createTestKiyoDataFile({ fileName: "file3.json" }));

      const files = await fileTable.getAllFiles();
      expect(files).toHaveLength(3);

      const names = await fileTable.getAllFileNames();
      expect(names.sort()).toEqual(["file1.json", "file2.json", "file3.json"]);
    });

    it("레코드가 없으면 빈 배열을 반환한다", async () => {
      const files = await fileTable.getAllFiles();
      expect(files).toEqual([]);

      const names = await fileTable.getAllFileNames();
      expect(names).toEqual([]);
    });
  });

  describe("deleteFileRecord", () => {
    it("fileName 인자로 해당 row만 삭제한다", async () => {
      await fileTable.upsertFileRecord("a.json", createTestKiyoDataFile({ fileName: "a.json" }));
      await fileTable.upsertFileRecord("b.json", createTestKiyoDataFile({ fileName: "b.json" }));
      await fileTable.upsertFileRecord("c.json", createTestKiyoDataFile({ fileName: "c.json" }));

      await fileTable.deleteFileRecord("b.json");

      const all = await fileTable.getAllFiles();
      expect(all).toHaveLength(2);
      const names = all.map((f) => f.fileName).sort();
      expect(names).toEqual(["a.json", "c.json"]);
    });

    it("존재하지 않는 fileName 삭제 시 에러가 나지 않는다", async () => {
      await expect(fileTable.deleteFileRecord("nonexistent.json")).resolves.not.toThrow();
    });
  });

  describe("resolveFileName", () => {
    it("빈 DB에서는 desired 그대로 반환", async () => {
      const result = await fileTable.resolveFileName("my-vault");
      expect(result).toBe("my-vault.json"); // normalizeDataFileName이 .json 강제
    });

    it("desired 존재 시 (1) suffix 부여", async () => {
      await fileTable.upsertFileRecord("my-vault.json", createTestKiyoDataFile({ fileName: "my-vault.json" }));
      const result = await fileTable.resolveFileName("my-vault");
      expect(result).toBe("my-vault(1).json");
    });

    it("desired + (1) 존재 시 (2) suffix 부여", async () => {
      await fileTable.upsertFileRecord("my-vault.json", createTestKiyoDataFile({ fileName: "my-vault.json" }));
      await fileTable.upsertFileRecord("my-vault(1).json", createTestKiyoDataFile({ fileName: "my-vault(1).json" }));
      const result = await fileTable.resolveFileName("my-vault");
      expect(result).toBe("my-vault(2).json");
    });

    it(".json이 이미 붙은 desired도 suffix 부여", async () => {
      await fileTable.upsertFileRecord("data.json", createTestKiyoDataFile({ fileName: "data.json" }));
      const result = await fileTable.resolveFileName("data.json");
      expect(result).toBe("data(1).json");
    });

    it("공백 trim + .json 강제", async () => {
      const result = await fileTable.resolveFileName("  vault  ");
      expect(result).toBe("vault.json");
    });
  });

  describe("Dexie v13 → v14 마이그레이션 (시나리오 B)", () => {
    it("v13 row(id='active')가 fileName PK로 승계된다", async () => {
      // 1. v13 schema DB 시드: id="active", fileName="legacy.json"
      const db = getDatabase();
      await db.files.clear();
      const v13Record: FileRecord = {
        id: "active",
        fileName: "legacy.json",
        fileData: JSON.stringify(createTestKiyoDataFile({ fileName: "legacy.json" })),
        encrypted: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
      await db.files.put(v13Record);

      // 2. v14 migration 로직 시뮬레이션: id="active" row를 fileName으로 승계
      // Dexie 4의 put은 PK가 변경되면 새 row로 처리될 수 있으므로,
      // delete + put 패턴으로 안전하게 승계
      const rows = await db.files.toArray();
      for (const row of rows) {
        if (row.id === "active" && row.fileName) {
          const newId = row.fileName;
          await db.files.delete("active");
          await db.files.put({ ...row, id: newId });
        }
      }

      // 3. 검증: id="active" 사라지고 id="legacy.json" 존재 (row 1개)
      const allRows = await db.files.toArray();
      expect(allRows).toHaveLength(1);
      expect(allRows[0].id).toBe("legacy.json");
      expect(allRows[0].fileName).toBe("legacy.json");

      // 4. 검증: getFileRecord("legacy.json") !== null
      const byFileName = await db.files.get("legacy.json");
      expect(byFileName).toBeDefined();

      // 5. 검증: getFileRecord("active") === undefined
      const byActive = await db.files.get("active");
      expect(byActive).toBeUndefined();
    });
  });

  describe("경계값/예외 상황", () => {
    it("fileData가 유효하지 않은 JSON이면 getFileInfo에서 에러가 전파된다", async () => {
      const record: FileRecord = {
        id: "bad.json",
        fileName: "bad.json",
        fileData: "{ not valid json }",
        encrypted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const db = getDatabase();
      await db.files.put(record);

      await expect(fileTable.getFileInfo("bad.json")).rejects.toThrow();
    });

    it("isEncryptedKiyoVaultData가 false인 데이터는 평문으로 처리된다", async () => {
      const fakeEncrypted = {
        version: 1,
        encrypted: true,
        // salt, iv, ciphertext 누락
      };
      const record: FileRecord = {
        id: "fake.json",
        fileName: "fake.json",
        fileData: JSON.stringify(fakeEncrypted),
        encrypted: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const db = getDatabase();
      await db.files.put(record);

      const info = await fileTable.getFileInfo("fake.json");
      expect(info.encrypted).toBe(false);
    });
  });
});
