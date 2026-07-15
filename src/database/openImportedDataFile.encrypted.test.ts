import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { useSessionStore } from "../store/sessionStore";
import { useAccountStore } from "../store/accountStore";
import {
  isEncryptedKiyoFile,
  createCryptoKey,
  decryptData,
} from "../crypto/encryption";
import { fromBase64 } from "../crypto/crypto.utils";
import { saveFileDataToDB, replaceDatabaseData } from "./db";
import { openImportedDataFile } from "./fileStorage";
import {
  createTestKiyoDataFile,
  createTestEncryptedFile,
} from "../test/fixtures/databaseFixtures";
import {
  createTestAccount,
  createTestField,
} from "../test/fixtures/accountFixtures";

// Import common mocks
import { createMockSessionStore } from "../test/mocks/sessionStoreMock";
import { createMockAccountStoreWithGetState } from "../test/mocks/accountStoreMock";
import { createMockEncryption } from "../test/mocks/encryptionMock";
import { createMockDB } from "../test/mocks/dbMock";
import { createMockCryptoUtils } from "../test/mocks/encryptionMock";

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

// Mock sessionStore
vi.mock("../store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(),
  },
}));

// Mock accountStore
vi.mock("../store/accountStore", () => ({
  useAccountStore: {
    getState: vi.fn(),
  },
}));

// Mock encryption functions
vi.mock("../crypto/encryption", () => ({
  isEncryptedKiyoFile: vi.fn(),
  createCryptoKey: vi.fn(),
  decryptData: vi.fn(),
  encryptData: vi.fn(),
  toBase64: vi.fn(),
}));

// Mock crypto.utils
vi.mock("../crypto/crypto.utils", () => ({
  fromBase64: vi.fn(),
  toBase64: vi.fn(),
}));

// Mock db functions
vi.mock("./db", () => ({
  saveFileDataToDB: vi.fn(),
  replaceDatabaseData: vi.fn(),
  getDatabaseSnapshot: vi.fn(),
  loadAccountsFromDB: vi.fn(),
  isNativeFileStorageAvailable: vi.fn(() => false),
}));

describe("openImportedDataFile - 암호화 파일 테스트", () => {
  let mockSessionStore: ReturnType<typeof createMockSessionStore>;
  let mockAccountStore: ReturnType<typeof createMockAccountStoreWithGetState>;
  let mockEncryption: ReturnType<typeof createMockEncryption>;
  let mockCryptoUtils: ReturnType<typeof createMockCryptoUtils>;
  let mockDB: ReturnType<typeof createMockDB>;

  const validJsonString = JSON.stringify(
    createTestKiyoDataFile({ fileName: "test.json" }),
  );
  const encryptedFile = createTestEncryptedFile();
  const encryptedJsonString = JSON.stringify(encryptedFile);
  const mockCryptoKey = {} as CryptoKey;
  const mockSalt = new Uint8Array(16);
  const mockDecryptedData = createTestKiyoDataFile({ fileName: "test.json" });

  beforeEach(() => {
    // Create fresh mocks for each test
    mockSessionStore = createMockSessionStore();
    mockAccountStore = createMockAccountStoreWithGetState();
    mockEncryption = createMockEncryption({
      mockIsEncryptedKiyoFile: vi.fn().mockReturnValue(true), // 암호화 파일로 인식
      mockCreateCryptoKey: vi.fn().mockResolvedValue({ key: mockCryptoKey, salt: mockSalt }),
      mockDecryptData: vi.fn().mockResolvedValue(mockDecryptedData),
    });
    mockCryptoUtils = createMockCryptoUtils({
      mockFromBase64: vi.fn().mockReturnValue(new Uint8Array(16)),
    });
    mockDB = createMockDB();

    // Configure mock implementations
    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
    vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);
    vi.mocked(isEncryptedKiyoFile).mockImplementation(
      mockEncryption.mockIsEncryptedKiyoFile,
    );
    vi.mocked(createCryptoKey).mockImplementation(
      mockEncryption.mockCreateCryptoKey,
    );
    vi.mocked(decryptData).mockImplementation(
      mockEncryption.mockDecryptData,
    );
    vi.mocked(fromBase64).mockImplementation(
      mockCryptoUtils.mockFromBase64,
    );
    vi.mocked(saveFileDataToDB).mockImplementation(mockDB.mockSaveFileDataToDB);
    vi.mocked(replaceDatabaseData).mockImplementation(
      mockDB.mockReplaceDatabaseData,
    );
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("정상 케이스 (암호화 파일)", () => {
    it("올바른 PIN으로 복호화 성공 시 모든 후속 처리를 수행한다", async () => {
      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).not.toBeNull();
      expect(result).toEqual({
        ...mockDecryptedData,
        fileName: "test.json",
      });

      // isEncryptedKiyoFile 호출 확인
      expect(mockEncryption.mockIsEncryptedKiyoFile).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          encrypted: true,
        }),
      );

      // fromBase64로 salt 디코딩 확인
      expect(mockCryptoUtils.mockFromBase64).toHaveBeenCalledWith(encryptedFile.salt);

      // createCryptoKey 호출 확인
      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledWith(
        "1234",
        expect.any(Uint8Array),
      );

      // decryptData 호출 확인
      expect(mockEncryption.mockDecryptData).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          encrypted: true,
          salt: encryptedFile.salt,
          iv: encryptedFile.iv,
          ciphertext: encryptedFile.ciphertext,
        }),
        mockCryptoKey,
      );

      // replaceDatabaseData 호출 확인
      expect(mockDB.mockReplaceDatabaseData).toHaveBeenCalledTimes(1);
      expect(mockDB.mockReplaceDatabaseData).toHaveBeenCalledWith(mockDecryptedData);

      // setSession 호출 확인 (fileName, cryptoKey, salt 전달)
      expect(mockSessionStore.mockSetSession).toHaveBeenCalledTimes(1);
      const callArgs = mockSessionStore.mockSetSession.mock.calls[0][0];
      expect(callArgs).toEqual(
        expect.objectContaining({
          fileName: "test.json",
          cryptoKey: mockCryptoKey,
          salt: mockSalt,
        }),
      );

      // saveFileDataToDB 호출 확인 (암호화된 데이터와 salt)
      expect(mockDB.mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockDB.mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(encryptedFile);
      expect(salt).toEqual(mockSalt);

      // setAccounts 호출 확인
      expect(mockAccountStore.mockSetAccounts).toHaveBeenCalledTimes(1);
      expect(mockAccountStore.mockSetAccounts).toHaveBeenCalledWith(mockDecryptedData.accounts);
    });

    it("데이터가 있는 accounts도 정상 처리한다", async () => {
      const testAccount = createTestAccount({
        id: 1,
        templateId: 1,
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
      });
      const decryptedWithAccounts = createTestKiyoDataFile({
        fileName: "test.json",
        accounts: [testAccount],
      });
      mockEncryption.mockDecryptData.mockResolvedValueOnce(decryptedWithAccounts);

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).not.toBeNull();
      expect(result!.accounts).toHaveLength(1);
      expect(mockDB.mockReplaceDatabaseData).toHaveBeenCalledWith(
        expect.objectContaining({
          accounts: decryptedWithAccounts.accounts,
        }),
      );
      expect(mockAccountStore.mockSetAccounts).toHaveBeenCalledWith(
        decryptedWithAccounts.accounts,
      );
    });

    it("isEncryptedKiyoFile이 false면 평문 로직으로 분기한다", async () => {
      mockEncryption.mockIsEncryptedKiyoFile.mockReturnValueOnce(false);

      const result = await openImportedDataFile(validJsonString, "");

      expect(result).not.toBeNull();
      expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
      expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
    });
  });

  describe("실패 케이스 (암호화 파일)", () => {
    it("salt 검증 실패 시 null을 반환한다 (누락, 문자열 아님, 길이 불일치)", async () => {
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
          mockIsEncryptedKiyoFile: vi.fn().mockReturnValue(true),
          mockCreateCryptoKey: vi.fn().mockResolvedValue({
            key: mockCryptoKey,
            salt: mockSalt || new Uint8Array(16),
          }),
          mockDecryptData: vi.fn().mockResolvedValue(mockDecryptedData),
        });
        mockCryptoUtils = createMockCryptoUtils({
          mockFromBase64: vi.fn().mockReturnValue(mockSalt || new Uint8Array(16)),
        });
        mockDB = createMockDB();

        // Configure mock implementations
        vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
        vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);
        vi.mocked(isEncryptedKiyoFile).mockImplementation(
          mockEncryption.mockIsEncryptedKiyoFile,
        );
        vi.mocked(createCryptoKey).mockImplementation(
          mockEncryption.mockCreateCryptoKey,
        );
        vi.mocked(decryptData).mockImplementation(
          mockEncryption.mockDecryptData,
        );
        vi.mocked(fromBase64).mockImplementation(
          mockCryptoUtils.mockFromBase64,
        );
        vi.mocked(saveFileDataToDB).mockImplementation(mockDB.mockSaveFileDataToDB);
        vi.mocked(replaceDatabaseData).mockImplementation(
          mockDB.mockReplaceDatabaseData,
        );
        vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

        const file = createTestEncryptedFile({ salt });
        const jsonString = JSON.stringify(file);

        const result = await openImportedDataFile(jsonString, "1234");

        expect(result).toBeNull();
        expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
        expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
      }
    });

    it("createCryptoKey 실패 시 null을 반환한다", async () => {
      mockEncryption.mockCreateCryptoKey.mockRejectedValueOnce(
        new Error("Key creation failed"),
      );

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
      expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
    });

    it("decryptData 실패 시 null을 반환한다 (잘못된 PIN)", async () => {
      mockEncryption.mockDecryptData.mockRejectedValueOnce(new Error("Decryption failed"));

      const result = await openImportedDataFile(
        encryptedJsonString,
        "wrong-pin",
      );

      expect(result).toBeNull();
      expect(mockDB.mockReplaceDatabaseData).not.toHaveBeenCalled();
      // setSession은 decryptData 이후에 호출되므로 decryptData 실패 시 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(mockDB.mockSaveFileDataToDB).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("복호화된 데이터가 isKiyoFile 검증 실패 시 null을 반환한다", async () => {
      // fileName이 있는 유효하지 않은 데이터로 mock 설정 (normalizeDataFileName에서 에러 방지)
      mockEncryption.mockDecryptData.mockResolvedValueOnce({
        invalid: "data",
        fileName: "test.json",
      });

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
      expect(mockDB.mockReplaceDatabaseData).not.toHaveBeenCalled();
      // setSession은 decryptData 이후, isKiyoFile 검증 이전에 호출되므로 호출됨
      expect(mockSessionStore.mockSetSession).toHaveBeenCalled();
      expect(mockDB.mockSaveFileDataToDB).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("replaceDatabaseData 실패 시 null을 반환한다", async () => {
      mockDB.mockReplaceDatabaseData.mockRejectedValueOnce(new Error("DB error"));

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
      // setSession은 replaceDatabaseData 이전에 호출되므로 호출됨
      expect(mockSessionStore.mockSetSession).toHaveBeenCalled();
      expect(mockDB.mockSaveFileDataToDB).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("saveFileDataToDB 실패 시 null을 반환한다", async () => {
      mockDB.mockSaveFileDataToDB.mockRejectedValueOnce(new Error("DB save failed"));

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
    });

    it("setSession 실패 시 null을 반환한다", async () => {
      mockSessionStore.mockSetSession.mockRejectedValueOnce(new Error("Session error"));

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
    });

    it("JSON 파싱 실패 또는 평문 파일 분기 시 null을 반환한다", async () => {
      // JSON 파싱 실패
      const invalidJson = "{ invalid json }";
      let result = await openImportedDataFile(invalidJson, "1234");
      expect(result).toBeNull();
      expect(mockEncryption.mockIsEncryptedKiyoFile).not.toHaveBeenCalled();

      // isEncryptedKiyoFile이 false 반환 (평문 로직으로 분기)
      vi.clearAllMocks();
      mockSessionStore = createMockSessionStore();
      mockAccountStore = createMockAccountStoreWithGetState();
      mockEncryption = createMockEncryption({
        mockIsEncryptedKiyoFile: vi.fn().mockReturnValue(false),
      });
      mockCryptoUtils = createMockCryptoUtils();
      mockDB = createMockDB();

      // Configure mock implementations
      vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
      vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);
      vi.mocked(isEncryptedKiyoFile).mockImplementation(
        mockEncryption.mockIsEncryptedKiyoFile,
      );
      vi.mocked(saveFileDataToDB).mockImplementation(mockDB.mockSaveFileDataToDB);
      vi.mocked(replaceDatabaseData).mockImplementation(
        mockDB.mockReplaceDatabaseData,
      );
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      result = await openImportedDataFile(validJsonString, "");
      expect(result).not.toBeNull();
      expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
      expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
    });
  });
});
