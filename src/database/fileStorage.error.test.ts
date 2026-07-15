import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import { useSessionStore } from "../store/sessionStore";
import { useAccountStore } from "../store/accountStore";
import { isEncryptedKiyoFile, createCryptoKey, decryptData } from "../crypto/encryption";
import { fromBase64 } from "../crypto/crypto.utils";
import { saveFileDataToDB, replaceDatabaseData, getDatabaseSnapshot } from "./db";
import { openImportedDataFile, writeDataFile } from "./fileStorage";
import { FileStorageError, FileStorageErrorCode, isFileStorageError } from "../errors/FileStorageError";
import { createTestEncryptedFile } from "../test/fixtures/databaseFixtures";
import { createMockEncryption } from "../test/mocks/encryptionMock";
import { createMockSessionStore } from "../test/mocks/sessionStoreMock";
import { createMockAccountStoreWithGetState } from "../test/mocks/accountStoreMock";
import { createMockDB } from "../test/mocks/dbMock";
import type { KiyoDataFile } from "./fileStorage";
import type { Account, Template, Setting, Metadata } from "../models/account";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));
vi.mock("@capacitor/filesystem", () => ({ Filesystem: { writeFile: vi.fn() } }));
vi.mock("../store/sessionStore", () => ({ useSessionStore: { getState: vi.fn() } }));
vi.mock("../store/accountStore", () => ({ useAccountStore: { getState: vi.fn() } }));
vi.mock("../crypto/encryption", () => ({ isEncryptedKiyoFile: vi.fn(), createCryptoKey: vi.fn(), decryptData: vi.fn(), encryptData: vi.fn() }));
vi.mock("../crypto/crypto.utils", () => ({ fromBase64: vi.fn(), toBase64: vi.fn() }));
vi.mock("./db", () => ({ saveFileDataToDB: vi.fn(), replaceDatabaseData: vi.fn(), getDatabaseSnapshot: vi.fn(), loadAccountsFromDB: vi.fn(), isNativeFileStorageAvailable: vi.fn(() => false) }));

describe("fileStorage - error handling", () => {
  let mockSessionStore: ReturnType<typeof createMockSessionStore>;
  let mockAccountStore: ReturnType<typeof createMockAccountStoreWithGetState>;
  let mockDB: ReturnType<typeof createMockDB>;
  let mockEncryption: ReturnType<typeof createMockEncryption>;

  const createValidKiyoFile = (overrides: Partial<KiyoDataFile> = {}): KiyoDataFile => ({
    version: 1, fileName: "test.json", updatedAt: Date.now(),
    accounts: [] as Account[], templates: [] as Template[],
    settings: [] as Setting[], metadata: [] as Metadata[],
    ...overrides,
  });

  const encryptedJsonString = JSON.stringify(createTestEncryptedFile());

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStore = createMockSessionStore();
    mockAccountStore = createMockAccountStoreWithGetState();
    mockDB = createMockDB();
    mockEncryption = createMockEncryption({ mockIsEncryptedKiyoFile: vi.fn().mockReturnValue(false) });

    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
    vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);
    vi.mocked(isEncryptedKiyoFile).mockImplementation(mockEncryption.mockIsEncryptedKiyoFile);
    vi.mocked(createCryptoKey).mockImplementation(mockEncryption.mockCreateCryptoKey);
    vi.mocked(decryptData).mockImplementation(mockEncryption.mockDecryptData);
    vi.mocked(fromBase64).mockImplementation(mockEncryption.mockFromBase64);
    vi.mocked(saveFileDataToDB).mockImplementation(mockDB.mockSaveFileDataToDB);
    vi.mocked(replaceDatabaseData).mockImplementation(mockDB.mockReplaceDatabaseData);
    vi.mocked(getDatabaseSnapshot).mockImplementation(mockDB.mockGetDatabaseSnapshot);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  afterEach(() => vi.resetAllMocks());

  describe("openImportedDataFile", () => {
    it("잘못된 JSON → null 반환 (INVALID_JSON 상황)", async () => {
      const result = await openImportedDataFile("{ invalid json }", "1234");
      expect(result).toBeNull();
    });

    it("잘못된 PIN → null 반환 (INVALID_PIN 상황)", async () => {
      mockEncryption.mockIsEncryptedKiyoFile.mockReturnValue(true);
      mockEncryption.mockCreateCryptoKey.mockRejectedValueOnce(new Error("Invalid PIN"));
      vi.mocked(isEncryptedKiyoFile).mockImplementation(mockEncryption.mockIsEncryptedKiyoFile);
      vi.mocked(createCryptoKey).mockImplementation(mockEncryption.mockCreateCryptoKey);

      const result = await openImportedDataFile(encryptedJsonString, "wrong-pin");
      expect(result).toBeNull();
    });

    it("잘못된 파일 형식 → null 반환 (INVALID_FORMAT 상황)", async () => {
      const result = await openImportedDataFile(JSON.stringify(createValidKiyoFile({ version: 2 as unknown as 1 })), "1234");
      expect(result).toBeNull();
    });
  });

  describe("writeDataFile", () => {
    it("파일 저장 실패 → WRITE_FAILED 에러를 던진다", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(Filesystem.writeFile).mockRejectedValueOnce(new Error("Write failed"));

      await expect(writeDataFile(createValidKiyoFile(), "test.json")).rejects.toThrow(FileStorageError);
      try { await writeDataFile(createValidKiyoFile(), "test.json"); }
      catch (error: unknown) { expect(isFileStorageError(error)).toBe(true); expect((error as FileStorageError).code).toBe(FileStorageErrorCode.WRITE_FAILED); }
    });
  });
});
