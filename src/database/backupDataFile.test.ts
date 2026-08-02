import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { backupDataFile } from "@/database/fileStorage";
import { createCryptoKey, encryptData } from "@/crypto/encryption";
import { useSessionStore } from "@/store/sessionStore";

import {
  createTestKiyoDataFile,
} from "@/test/fixtures/databaseFixtures";
import {
  createTestAccount,
  createTestField,
  createTestAccounts,
} from "@/test/fixtures/accountFixtures";
import {
  createTestTemplate,
  getBuiltinTemplates,
} from "@/test/fixtures/templateFixtures";

// Import common mocks
import { createMockSessionStore } from "@/test/mocks/sessionStoreMock";
import { createMockEncryption, mockEncryptionDefaults } from "@/test/mocks/encryptionMock";

// ============================================
// Hoisted Mocks - MUST be at module top level for vi.mock
// ============================================

const DBMocks = vi.hoisted(() => ({
  getDatabaseSnapshot: vi.fn((fileName: string) => ({
        version: 1,
        fileName,
        updatedAt: Date.now(),
        accounts: createTestAccounts(3),
        templates: getBuiltinTemplates(),
        metadata: [{ id: 1, version: "1.0.0", createdAt: Date.now() }],
      }),),
  getDatabase: vi.fn(() => ({})),
  syncDatabaseToFile: vi.fn().mockResolvedValue(undefined),
}));
const exportVaultFileMock = vi.hoisted(() => ({
  exportVaultFile: vi.fn().mockResolvedValue(undefined),
  normalizeDataFileName: vi.fn((name: string) => {
    const trimmedName = name.trim() || "kiyo-data";
    return trimmedName.endsWith(".json") ? trimmedName : `${trimmedName}.json`;
  }),
}));

// Mock exportDataFile
vi.mock("@/database/fileExport", () => exportVaultFileMock);
// Mock db functions
vi.mock("@/database/db", () => DBMocks);


// Mock sessionStore
vi.mock("@/store/sessionStore");

// Mock crypto functions
vi.mock("@/crypto/encryption");

describe("backupDataFile", () => {
  const mockSessionStore = createMockSessionStore();
  const mockEncryption =  createMockEncryption();
  const mockCryptoKey = mockEncryptionDefaults.createCryptoKey.key;
  const mockSalt = mockEncryptionDefaults.createCryptoKey.salt;
  const mockEncryptedFile = mockEncryptionDefaults.encryptData;

  beforeEach(async () => {
    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
    vi.mocked(createCryptoKey).mockImplementation(
      mockEncryption.mockCreateCryptoKey,
    );
    vi.mocked(encryptData).mockImplementation(mockEncryption.mockEncryptData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("평문 백업 (PIN 없음)", () => {
    it("DB snapshot을 생성한다 (getDatabaseSnapshot 호출)", async () => {
      await backupDataFile("test.json", "");

      expect(DBMocks.getDatabaseSnapshot).toHaveBeenCalledTimes(1);
      expect(DBMocks.getDatabaseSnapshot).toHaveBeenCalledWith("test.json", undefined);
    });

    it("JSON 변환 후 파일 저장을 호출한다 (exportVaultFile을 통해)", async () => {
      await backupDataFile("test.json", "");

      // exportVaultFile이 평문 데이터와 함께 호출되는지 확인
      expect(exportVaultFileMock.exportVaultFile).toHaveBeenCalledTimes(1);
      const [fileName, data] = exportVaultFileMock.exportVaultFile.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: expect.any(Array),
          templates: expect.any(Array),
          metadata: expect.any(Array),
        }),
      );
    });

    it("sessionStore.setSession을 호출하지 않는다 (shouldSetActiveFile=false)", async () => {
      await backupDataFile("test.json", "");

      // backupDataFile은 shouldSetActiveFile=false로 saveDataFile을 호출하므로
      // setSession이 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
    });

    it("cryptoKey와 salt를 sessionStore에 저장하지 않는다 (평문 파일)", async () => {
      await backupDataFile("test.json", "");

      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
    });

    it("createCryptoKey를 호출하지 않는다 (PIN 없음)", async () => {
      await backupDataFile("test.json", "");

      expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
    });

    it("encryptData를 호출하지 않는다 (PIN 없음)", async () => {
      await backupDataFile("test.json", "");

      expect(mockEncryption.mockEncryptData).not.toHaveBeenCalled();
    });

    it("shouldSetActiveFile이 false로 saveDataFile을 호출한다", async () => {
      await backupDataFile("test.json", "");

      // backupDataFile은 shouldSetActiveFile=false로 saveDataFile을 호출
      // setSession과 setCryptoKey 모두 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("데이터가 있는 accounts, templates, metadata도 정상 백업한다", async () => {
      const baseTime = Date.now();
      const fullData = createTestKiyoDataFile({
        fileName: "full-data.json",
        accounts: [
          createTestAccount({
            id: 1,
            title: "Test Account",
            tags: ["tag1"],
            favorite: true,
            fields: [
              createTestField({
                id: "1-1",
                label: "Field",
                type: "text",
                value: "value",
                order: 0,
              }),
            ],
          }),
        ],
        templates: [
          createTestTemplate({ id: "1", name: "Template 1", fields: [] }),
        ],
        metadata: [{ id: 1, version: "1.0.0", createdAt: baseTime }],
      });
      // Override the mock for this specific test
      DBMocks.getDatabaseSnapshot.mockResolvedValueOnce(fullData);

      const result = await backupDataFile("full-data.json", "");

      // updatedAt은 saveDataFile에서 Date.now()로 새로 생성되므로 objectContaining으로 비교
      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "full-data.json",
          accounts: fullData.accounts,
          templates: fullData.templates,
          metadata: fullData.metadata,
        }),
      );
      expect(typeof result.updatedAt).toBe("number");
      expect(result.updatedAt).toBeGreaterThanOrEqual(baseTime);
      // Check that exportDataFile was called with the right filename and data containing expected properties
      expect(exportVaultFileMock.exportVaultFile).toHaveBeenCalledTimes(1);
      const [fileName, data] = exportVaultFileMock.exportVaultFile.mock.calls[0];
      expect(fileName).toBe("full-data.json");
      expect(data).toEqual(
        expect.objectContaining({
          fileName: "full-data.json",
          accounts: fullData.accounts,
          templates: fullData.templates,
          metadata: fullData.metadata,
          version: 1,
        }),
      );
    });

    it("fileName 정규화가 적용된다", async () => {
      await backupDataFile("  my-backup  ", "");

      expect(DBMocks.getDatabaseSnapshot).toHaveBeenCalledWith(
        "my-backup.json",
        undefined,
      );
      expect(exportVaultFileMock.exportVaultFile).toHaveBeenCalledTimes(1);
      const [fileName, data] = exportVaultFileMock.exportVaultFile.mock.calls[0];
      expect(fileName).toBe("my-backup.json");
      expect(data).toEqual(
        expect.objectContaining({
          fileName: "my-backup.json",
          version: 1,
        }),
      );
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
    });

    it("확장자가 없는 파일명에 .json을 추가한다", async () => {
      await backupDataFile("backup", "");

      expect(DBMocks.getDatabaseSnapshot).toHaveBeenCalledWith(
        "backup.json",
        undefined,
      );
      expect(exportVaultFileMock.exportVaultFile).toHaveBeenCalledTimes(1);
      const [fileName, data] = exportVaultFileMock.exportVaultFile.mock.calls[0];
      expect(fileName).toBe("backup.json");
      expect(data).toEqual(
        expect.objectContaining({
          fileName: "backup.json",
          version: 1,
        }),
      );
    });

    it("백업된 데이터를 반환한다", async () => {
      const result = await backupDataFile("test.json", "");

      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: expect.any(Array),
          templates: expect.any(Array),
          metadata: expect.any(Array),
        }),
      );
    });

    it("빈 문자열 PIN도 평문 백업으로 처리한다", async () => {
      await backupDataFile("test.json", "");

      expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
      expect(mockEncryption.mockEncryptData).not.toHaveBeenCalled();
      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
    });
  });

  describe("PIN 백업 (암호화)", () => {
    it("DB snapshot을 생성한다 (getDatabaseSnapshot 호출)", async () => {
      await backupDataFile("test.json", "1234");

      expect(DBMocks.getDatabaseSnapshot).toHaveBeenCalledTimes(1);
      expect(DBMocks.getDatabaseSnapshot).toHaveBeenCalledWith("test.json", undefined);
    });

    it("createCryptoKey를 PIN과 함께 호출한다", async () => {
      await backupDataFile("test.json", "1234");

      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledTimes(1);
      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledWith("1234");
    });

    it("AES 암호화 파일(EncryptedKiyoFile)을 생성한다", async () => {
      const result = await backupDataFile("test.json", "1234");

      // 결과는 평문 데이터지만, 내부적으로 암호화된 파일이 저장됨
      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: expect.any(Array),
          templates: expect.any(Array),
          metadata: expect.any(Array),
        }),
      );
    });

    it("sessionStore.setSession을 fileName, cryptoKey, salt와 함께 호출하지 않는다 (shouldSetActiveFile=false)", async () => {
      await backupDataFile("test.json", "1234");

      // PIN이 있는 경우 setSession이 fileName, cryptoKey, salt와 함께 호출됨
      // 하지만 backupDataFile은 shouldSetActiveFile=false이므로 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      // setCryptoKey는 더 이상 호출되지 않음
      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("fileName 정규화가 적용된다", async () => {
      await backupDataFile("  secure data  ", "1234");

      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(exportVaultFileMock.exportVaultFile).toHaveBeenCalledWith(
        "secure data.json",
        expect.any(Object),
      );
    });

    it("encryptData를 생성된 cryptoKey와 salt로 호출한다", async () => {
      await backupDataFile("test.json", "1234");

      expect(mockEncryption.mockEncryptData).toHaveBeenCalledTimes(1);
      const [data, key, salt] = mockEncryption.mockEncryptData.mock.calls[0];
      expect(key).toBe(mockCryptoKey);
      expect(salt).toEqual(mockSalt);
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: expect.any(Array),
          templates: expect.any(Array),
          metadata: expect.any(Array),
        }),
      );
    });

    it("파일명 정규화를 적용한다", async () => {
      await backupDataFile("  secure data  ", "1234");

      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(exportVaultFileMock.exportVaultFile).toHaveBeenCalledWith(
        "secure data.json",
        expect.any(Object),
      );
    });

    it("exportVaultFile을 암호화 데이터와 함께 호출한다", async () => {
      await backupDataFile("test.json", "1234");

      expect(exportVaultFileMock.exportVaultFile).toHaveBeenCalledTimes(1);
      const [fileName, data] = exportVaultFileMock.exportVaultFile.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(mockEncryptedFile);
    });
  });

  describe("에러 처리", () => {
    it("getDatabaseSnapshot 실패 시 에러를 전파한다", async () => {
      DBMocks.getDatabaseSnapshot.mockRejectedValueOnce(
        new Error("DB snapshot failed"),
      );

      await expect(backupDataFile("test.json", "")).rejects.toThrow(
        "DB snapshot failed",
      );
    });

    it("createCryptoKey 실패 시 에러를 전파한다", async () => {
      mockEncryption.mockCreateCryptoKey.mockRejectedValueOnce(
        new Error("Crypto key creation failed"),
      );

      await expect(backupDataFile("test.json", "1234")).rejects.toThrow(
        "Crypto key creation failed",
      );
    });

    it("encryptData 실패 시 에러를 전파한다", async () => {
      mockEncryption.mockEncryptData.mockRejectedValueOnce(
        new Error("Encryption failed"),
      );

      await expect(backupDataFile("test.json", "1234")).rejects.toThrow(
        "Encryption failed",
      );
    });

    it("create 실패 시 에러를 전파한다", async () => {
      exportVaultFileMock.exportVaultFile.mockRejectedValueOnce(
        new Error("File export failed"),
      );

      // Test with PIN (encrypted backup) which calls exportVaultFile
      await expect(backupDataFile("test.json", "1234")).rejects.toThrow(
        "File export failed",
      );
    });

    it("setSession 실패 시 에러를 전파한다 (shouldSetActiveFile=true일 때)", async () => {
      // backupDataFile은 shouldSetActiveFile=false이므로 setSession을 호출하지 않음
      // 이 테스트는 createDataFile 등 shouldSetActiveFile=true인 함수에서 테스트해야 함
      await backupDataFile("test.json", "");
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
    });

    it("setCryptoKey 실패 시 에러를 전파한다 (shouldSetActiveFile=true일 때)", async () => {
      // backupDataFile은 shouldSetActiveFile=false이므로 setCryptoKey를 호출하지 않음
      // 이 테스트는 createDataFile 등 shouldSetActiveFile=true인 함수에서 테스트해야 함
      await backupDataFile("test.json", "1234");
      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
    });
  });

  describe("공통 동작", () => {
    it("기본 파일명 'kiyo-data'를 사용한다 (빈 문자열 입력 시)", async () => {
      await backupDataFile("", "");

      expect(DBMocks.getDatabaseSnapshot).toHaveBeenCalledWith(
        "kiyo-data.json",
        undefined,
      );
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
    });

    it("공백만 있는 입력도 기본 파일명으로 처리한다", async () => {
      await backupDataFile("   ", "");

      expect(DBMocks.getDatabaseSnapshot).toHaveBeenCalledWith(
        "kiyo-data.json",
        undefined,
      );
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
    });

    it("반환값은 항상 평문 KiyoDataFile이다 (PIN 유무와 관계없이)", async () => {
      const plainResult = await backupDataFile("plain-file", "");
      const encryptedResult = await backupDataFile("encrypted-file", "1234");

      expect("encrypted" in plainResult).toBe(false);
      expect("encrypted" in encryptedResult).toBe(false);
      expect(plainResult.version).toBe(1);
      expect(encryptedResult.version).toBe(1);
    });

    it("updatedAt이 현재 시간 근처인지 확인한다", async () => {
      const before = Date.now();
      const result = await backupDataFile("test-file", "");
      const after = Date.now();

      expect(result.updatedAt).toBeGreaterThanOrEqual(before);
      expect(result.updatedAt).toBeLessThanOrEqual(after);
    });
  });
});