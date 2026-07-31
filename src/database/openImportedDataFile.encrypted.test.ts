import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { useSessionStore } from "../store/sessionStore";
import { useAccountStore } from "../store/accountStore";
import { isEncryptedKiyoFile, createCryptoKey, decryptData } from "../crypto/encryption";
import { fromBase64 } from "../crypto/crypto.utils";
import { openImportedDataFile } from "./fileStorage";
import { createTestKiyoDataFile, createTestEncryptedFile } from "../test/fixtures/databaseFixtures";
import { replaceDatabaseData } from "./db";
import { createMockSessionStore } from "../test/mocks/sessionStoreMock";
import { createMockAccountStoreWithGetState } from "../test/mocks/accountStoreMock";
import { createMockEncryption } from "../test/mocks/encryptionMock";
import { createMockCryptoUtils } from "../test/mocks/encryptionMock";

// Hoisted mocks for vi.mock
const fileTableMock = vi.hoisted(() => ({
  fileTable: {
    saveFileDataToDB: vi.fn().mockResolvedValue(undefined),
    saveActiveFileInfo: vi.fn().mockResolvedValue(undefined),
    getActiveFileInfo: vi.fn().mockResolvedValue({
      activeFileName: null,
      salt: null,
      encrypted: false,
      fileData: null,
    }),
    clearActiveFileInfo: vi.fn().mockResolvedValue(undefined),
    getAllFileNames: vi.fn().mockResolvedValue([]),
  },
}));

const dbMock = vi.hoisted(() => ({
  mockReplaceDatabaseData: vi.fn().mockResolvedValue(undefined),
  mockGetDatabaseSnapshot: vi.fn(),
  mockInitializeDatabase: vi.fn().mockResolvedValue(undefined),
  mockSyncDatabaseToFile: vi.fn().mockResolvedValue(undefined),
  mockLoadAccountsFromDB: vi.fn().mockResolvedValue([]),
  mockIsNativeFileStorageAvailable: vi.fn(() => false),
}));

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn(() => ({
    isAutofillEnabled: vi.fn().mockResolvedValue({ enabled: false, hasService: false, servicePackageName: null }),
    getAutofillServiceInfo: vi.fn().mockResolvedValue({ isEnabled: false, isOurService: false, servicePackageName: null }),
    requestAutofillEnable: vi.fn().mockResolvedValue(undefined),
    getAccountCount: vi.fn().mockResolvedValue({ count: 0 }),
    syncAccountsFromReact: vi.fn().mockResolvedValue({ success: true, syncedCount: 0, errorCount: 0 }),
    syncAccounts: vi.fn().mockResolvedValue({ syncedCount: 0, errorCount: 0, totalProcessed: 0 }),
    getAccounts: vi.fn().mockResolvedValue({ accounts: [], count: 0 }),
    addAccount: vi.fn().mockResolvedValue({ id: 1, success: true }),
    updateAccount: vi.fn().mockResolvedValue({ updated: true, id: 1 }),
    deleteAccount: vi.fn().mockResolvedValue({ deleted: true, id: 1 }),
    toggleFavorite: vi.fn().mockResolvedValue({ success: true, id: 1 }),
    clearAllAccounts: vi.fn().mockResolvedValue({ deletedCount: 0, success: true }),
  })),
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => 'web'),
  },
}));

// Mock sessionStore
vi.mock("../store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(() => ({
      setSession: vi.fn(),
      setCryptoKey: vi.fn(),
      clearSession: vi.fn(),
    })),
  },
}));

// Mock accountStore
vi.mock("../store/accountStore", () => ({
  useAccountStore: {
    getState: vi.fn(() => ({
      setAccounts: vi.fn(),
    })),
  },
}));

// Mock KiyoAutofill plugin
vi.mock("../plugins/kiyautofill", () => ({
  KiyoAutofill: {
    saveSession: vi.fn().mockResolvedValue(undefined),
    clearSession: vi.fn().mockResolvedValue(undefined),
    hasSession: vi.fn().mockResolvedValue({ hasSession: false }),
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
  exportCryptoKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
}));

// Mock fileTable using hoisted mock
vi.mock("./fileTable", () => fileTableMock);

// Mock db functions
vi.mock("./db", () => ({
  replaceDatabaseData: dbMock.mockReplaceDatabaseData,
  getDatabaseSnapshot: dbMock.mockGetDatabaseSnapshot,
  loadAccountsFromDB: dbMock.mockLoadAccountsFromDB,
  syncDatabaseToFile: dbMock.mockSyncDatabaseToFile,
  initializeDatabase: dbMock.mockInitializeDatabase,
  isNativeFileStorageAvailable: dbMock.mockIsNativeFileStorageAvailable,
}));

describe("openImportedDataFile - 암호화 파일 에러 분기 테스트", () => {
  let mockSessionStore: ReturnType<typeof createMockSessionStore>;
  let mockAccountStore: ReturnType<typeof createMockAccountStoreWithGetState>;
  let mockEncryption: ReturnType<typeof createMockEncryption>;
  let mockCryptoUtils: ReturnType<typeof createMockCryptoUtils>;

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
      mockIsEncryptedKiyoFile: vi.fn().mockReturnValue(true),
    });
    mockCryptoUtils = createMockCryptoUtils({
      mockFromBase64: vi.fn().mockReturnValue(new Uint8Array(16)),
    });

    // Configure mock implementations
    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
    vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);

    vi.mocked(isEncryptedKiyoFile).mockReturnValue(true);
    vi.mocked(createCryptoKey).mockImplementation(mockEncryption.mockCreateCryptoKey);
    vi.mocked(decryptData).mockImplementation(mockEncryption.mockDecryptData);
    vi.mocked(fromBase64).mockImplementation(mockCryptoUtils.mockFromBase64);
    vi.mocked(replaceDatabaseData).mockImplementation(dbMock.mockReplaceDatabaseData);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
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

        // Configure mock implementations
        vi.mocked(isEncryptedKiyoFile).mockReturnValue(true);
        vi.mocked(createCryptoKey).mockImplementation(mockEncryption.mockCreateCryptoKey);
        vi.mocked(decryptData).mockImplementation(mockEncryption.mockDecryptData);
        vi.mocked(fromBase64).mockImplementation(mockCryptoUtils.mockFromBase64);
        vi.mocked(replaceDatabaseData).mockImplementation(dbMock.mockReplaceDatabaseData);
        vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

        const file = createTestEncryptedFile({ salt });
        const jsonString = JSON.stringify(file);

        await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toThrow();
        expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
        expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
      }
    });

    it("createCryptoKey 실패 시 에러를 던진다", async () => {
      mockEncryption.mockCreateCryptoKey.mockRejectedValueOnce(
        new Error("Key creation failed"),
      );

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow("PIN 불일치");
      expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
    });

    it("decryptData 실패 시 에러를 던진다 (잘못된 PIN)", async () => {
      mockEncryption.mockDecryptData.mockRejectedValueOnce(new Error("Decryption failed"));

      await expect(
        openImportedDataFile(
          encryptedJsonString,
          "wrong-pin",
          "test.json",
        ),
      ).rejects.toThrow("PIN 불일치");
      expect(dbMock.mockReplaceDatabaseData).not.toHaveBeenCalled();
      // setSession은 decryptData 이후에 호출되므로 decryptData 실패 시 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(fileTableMock.fileTable.saveFileDataToDB).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("복호화된 데이터가 isKiyoFile 검증 실패 시 에러를 던진다", async () => {
      // fileName이 있는 유효하지 않은 데이터로 mock 설정 (normalizeDataFileName에서 에러 방지)
      mockEncryption.mockDecryptData.mockResolvedValueOnce({
        invalid: "data",
        fileName: "test.json",
      });

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow("PIN 불일치");
      expect(dbMock.mockReplaceDatabaseData).not.toHaveBeenCalled();
      // setSession은 isKiyoFile 검증 이후에 호출되므로 isKiyoFile 실패 시 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(fileTableMock.fileTable.saveFileDataToDB).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("replaceDatabaseData 실패 시 에러를 던진다", async () => {
      dbMock.mockReplaceDatabaseData.mockRejectedValueOnce(new Error("DB error"));

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow("PIN 불일치");
      // setSession은 replaceDatabaseData 이전에 호출되므로 호출됨
      expect(mockSessionStore.mockSetSession).toHaveBeenCalled();
      // saveFileDataToDB도 replaceDatabaseData 이전에 호출되므로 호출됨
      expect(fileTableMock.fileTable.saveFileDataToDB).toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
    });

    it("saveFileDataToDB 실패 시 에러를 던진다", async () => {
      fileTableMock.fileTable.saveFileDataToDB.mockRejectedValueOnce(new Error("DB save failed"));

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow("PIN 불일치");
    });

    it("setSession 실패 시 에러를 던진다", async () => {
      mockSessionStore.mockSetSession.mockRejectedValueOnce(new Error("Session error"));

      await expect(
        openImportedDataFile(encryptedJsonString, "1234", "test.json"),
      ).rejects.toThrow("PIN 불일치");
    });

    it("JSON 파싱 실패 또는 평문 파일 분기 시 에러를 던진다", async () => {
      // JSON 파싱 실패
      const invalidJson = "{ invalid json }";
      await expect(
        openImportedDataFile(invalidJson, "1234", "test.json"),
      ).rejects.toThrow("JSON 파싱 실패");
      expect(mockEncryption.mockIsEncryptedKiyoFile).not.toHaveBeenCalled();

      // isEncryptedKiyoFile이 false 반환 (평문 로직으로 분기)
      vi.clearAllMocks();
      mockSessionStore = createMockSessionStore();
      mockAccountStore = createMockAccountStoreWithGetState();
      mockEncryption = createMockEncryption({
        mockIsEncryptedKiyoFile: vi.fn().mockReturnValue(false),
      });
      mockCryptoUtils = createMockCryptoUtils();

      // Configure mock implementations
      vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
      vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);
      vi.mocked(isEncryptedKiyoFile).mockImplementation(mockEncryption.mockIsEncryptedKiyoFile);
      vi.mocked(replaceDatabaseData).mockImplementation(dbMock.mockReplaceDatabaseData);
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      // 평문 파일도 현재는 에러를 던짐
      await expect(
        openImportedDataFile(validJsonString, "", "test.json"),
      ).rejects.toThrow();
      expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
      expect(mockEncryption.mockDecryptData).not.toHaveBeenCalled();
    });
  });
});