import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import {  createCryptoKey, decryptData, isEncryptedKiyoFile } from "@/crypto/encryption";
import { openImportedDataFile } from "@/database/fileStorage";
import { createTestKiyoDataFile, createTestEncryptedFile } from "@/test/fixtures/databaseFixtures";
import { replaceDatabaseData } from "@/database/db";
import { createMockSessionStore } from "@/test/mocks/sessionStoreMock";
import { createMockAccountStoreWithGetState } from "@/test/mocks/accountStoreMock";
import { createMockEncryption } from "@/test/mocks/encryptionMock";
import { FileStorageError, FileStorageErrorCode, } from "@/errors/FileStorageError";

// Hoisted mocks for vi.mock
const fileTableMock = vi.hoisted(() => ({
  fileTable: {
    saveFileDataToDB: vi.fn().mockResolvedValue(undefined),
  },
}));

const dbMock = vi.hoisted(() => ({
  replaceDatabaseData: vi.fn().mockResolvedValue(undefined),
}));


// Mock fileTable using hoisted mock
vi.mock("@/database/fileTable", () => fileTableMock);

// Mock db functions
vi.mock("@/database/db", () => (dbMock));
// Mock sessionStore
vi.mock("@/store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(() => ({
      setSession: vi.fn(),
      setCryptoKey: vi.fn(),
      clearSession: vi.fn(),
    })),
  },
}));

// Mock accountStore
vi.mock("@/store/accountStore", () => ({
  useAccountStore: {
    getState: vi.fn(() => ({
      setAccounts: vi.fn(),
    })),
  },
}));

// Mock encryption functions
vi.mock("@/crypto/encryption", () => ({
  isEncryptedKiyoFile: vi.fn(),
  createCryptoKey: vi.fn(),
  decryptData: vi.fn(),
}));



describe("openImportedDataFile - 암호화 파일 에러 분기 테스트", () => {
  let mockSessionStore: ReturnType<typeof createMockSessionStore>;
  let mockAccountStore: ReturnType<typeof createMockAccountStoreWithGetState>;
  let mockEncryption: ReturnType<typeof createMockEncryption>;

  const validJsonString = JSON.stringify(
    createTestKiyoDataFile({ fileName: "test.json" }),
  );
  const encryptedFile = createTestEncryptedFile();
  const encryptedJsonString = JSON.stringify(encryptedFile);
  const mockCryptoKey = {} as CryptoKey;
  const mockSalt = new Uint8Array(16);
  const mockDecryptedData = createTestKiyoDataFile({ fileName: "test.json" });

  beforeEach(async () => {
    // Create fresh mocks for each test
    mockSessionStore = createMockSessionStore();
    mockAccountStore = createMockAccountStoreWithGetState();
    mockEncryption = createMockEncryption({
      mockCreateCryptoKey: vi.fn().mockResolvedValue({ key: mockCryptoKey, salt: mockSalt }),
      mockDecryptData: vi.fn().mockResolvedValue(mockDecryptedData),
      mockIsEncryptedKiyoFile: vi.fn().mockResolvedValue(true),
    });

    // Configure mock implementations
    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
    vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);

    vi.mocked(createCryptoKey).mockImplementation(mockEncryption.mockCreateCryptoKey);
    vi.mocked(decryptData).mockImplementation(mockEncryption.mockDecryptData);
    vi.mocked(replaceDatabaseData).mockImplementation(dbMock.replaceDatabaseData);
    vi.mocked(replaceDatabaseData).mockImplementation(dbMock.replaceDatabaseData);
    vi.mocked(isEncryptedKiyoFile).mockImplementation(mockEncryption.mockIsEncryptedKiyoFile);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("실패 케이스 (암호화 파일)", () => {
    it("salt 검증 실패 시 에러를 던진다 (누락, 문자열 아님, 길이 불일치)", async () => {
      const saltTestCases = [
        { desc: "누락", salt: undefined as unknown as string },
        { desc: "문자열 아님", salt: 123 as unknown as string },
        {
          desc: "길이 불일치(8바이트)",
          salt: "valid",
          mockSalt: new Uint8Array(8),
        },
      ];

      for (const { salt, mockSalt } of saltTestCases) {
        vi.clearAllMocks();

        // Setup mocks for each iteration
        mockSessionStore = createMockSessionStore();
        mockAccountStore = createMockAccountStoreWithGetState();
        mockEncryption = createMockEncryption({
          mockCreateCryptoKey: vi.fn().mockResolvedValue({
            key: mockCryptoKey,
            salt: mockSalt || new Uint8Array(16),
          }),
          mockDecryptData: vi.fn().mockResolvedValue(mockDecryptedData),
        });

        // Configure mock implementations
        vi.mocked(createCryptoKey).mockImplementation(mockEncryption.mockCreateCryptoKey);
        vi.mocked(decryptData).mockImplementation(mockEncryption.mockDecryptData);
        vi.mocked(replaceDatabaseData).mockImplementation(dbMock.replaceDatabaseData);

        const file = createTestEncryptedFile({ salt });
        const jsonString = JSON.stringify(file);

        await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toThrow();
        expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
        expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
      }
    });

    it("createCryptoKey 실패 시 에러를 던진다", async () => {
      mockEncryption.mockCreateCryptoKey.mockRejectedValue(
        new Error("Key creation failed"),
      );

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.PIN_MISMATCH,
      });
      expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
    });

    it("decryptData 실패 시 에러를 던진다 (잘못된 PIN)", async () => {
      mockEncryption.mockDecryptData.mockRejectedValue(new Error("Decryption failed"));

      await expect(
        openImportedDataFile(
          encryptedJsonString,
          "wrong-pin",
          "test.json",
        ),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(
          encryptedJsonString,
          "wrong-pin",
          "test.json",
        ),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.PIN_MISMATCH,
      });
      expect(dbMock.replaceDatabaseData).not.toHaveBeenCalled();
      // setSession은 decryptData 이후에 호출되므로 decryptData 실패 시 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(fileTableMock.fileTable.saveFileDataToDB).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("복호화된 데이터가 isKiyoFile 검증 실패 시 INVALID_DATA_FORMAT 에러를 던진다", async () => {
      // fileName이 있는 유효하지 않은 데이터로 mock 설정 (normalizeDataFileName에서 에러 방지)
      mockEncryption.mockDecryptData.mockResolvedValue({
        invalid: "data",
        fileName: "test.json",
      });

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.INVALID_DATA_FORMAT,
      });
      expect(dbMock.replaceDatabaseData).not.toHaveBeenCalled();
      // setSession은 isKiyoFile 검증 이후에 호출되므로 isKiyoFile 실패 시 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(fileTableMock.fileTable.saveFileDataToDB).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("replaceDatabaseData 실패 시 DATABASE_ERROR 에러를 던진다", async () => {
      dbMock.replaceDatabaseData.mockRejectedValue(new Error("DB error"));

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.DATABASE_ERROR,
      });
      // setSession은 replaceDatabaseData 이전에 호출되므로 호출됨
      expect(mockSessionStore.mockSetSession).toHaveBeenCalled();
      // saveFileDataToDB도 replaceDatabaseData 이전에 호출되므로 호출됨
      expect(fileTableMock.fileTable.saveFileDataToDB).toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("saveFileDataToDB 실패 시 DATABASE_ERROR 에러를 던진다", async () => {
      fileTableMock.fileTable.saveFileDataToDB.mockRejectedValue(new Error("DB save failed"));

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.DATABASE_ERROR,
      });
    });

    it("setSession 실패 시 DATABASE_ERROR 에러를 던진다", async () => {
      mockSessionStore.mockSetSession.mockRejectedValue(new Error("Session error"));

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.DATABASE_ERROR,
      });
    });

    it("JSON 파싱 실패 또는 평문 파일 분기 시 에러를 던진다", async () => {
      // JSON 파싱 실패
      const invalidJson = "{ invalid json }";
      await expect(
        openImportedDataFile(invalidJson, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(invalidJson, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.INVALID_JSON,
      });
      vi.clearAllMocks();
      mockSessionStore = createMockSessionStore();
      mockAccountStore = createMockAccountStoreWithGetState();

      // Configure mock implementations
      vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
      vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);
      vi.mocked(replaceDatabaseData).mockImplementation(dbMock.replaceDatabaseData);

      // 평문 파일도 현재는 에러를 던짐
      await expect(
        openImportedDataFile(validJsonString, "", "test.json"),
      ).rejects.toThrow(FileStorageError);
      expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
      expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
    });
  });
});