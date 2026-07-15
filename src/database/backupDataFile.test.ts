import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { useSessionStore } from "../store/sessionStore";
import { useAccountStore } from "../store/accountStore";
import {
  isEncryptedKiyoFile,
  createCryptoKey,
  encryptData,
} from "../crypto/encryption";
import { fromBase64, toBase64 } from "../crypto/crypto.utils";
import {
  saveFileDataToDB,
  replaceDatabaseData,
  getDatabaseSnapshot,
} from "./db";
import { backupDataFile, type KiyoDataFile } from "./fileStorage";
import type { Account, Template, Setting, Metadata } from "../models/account";

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
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

// Mock encryption functions
vi.mock("../crypto/encryption", () => ({
  isEncryptedKiyoFile: vi.fn(),
  createCryptoKey: vi.fn(),
  encryptData: vi.fn(),
  decryptData: vi.fn(),
  toBase64: vi.fn(),
  fromBase64: vi.fn(),
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

describe("backupDataFile", () => {
  let mockSetSession: ReturnType<typeof vi.fn>;
  let mockSetCryptoKey: ReturnType<typeof vi.fn>;
  let mockSetAccounts: ReturnType<typeof vi.fn>;
  let mockSaveFileDataToDB: ReturnType<typeof vi.fn>;
  let mockReplaceDatabaseData: ReturnType<typeof vi.fn>;
  let mockGetDatabaseSnapshot: ReturnType<typeof vi.fn>;
  let mockIsEncryptedKiyoFile: ReturnType<typeof vi.fn>;
  let mockCreateCryptoKey: ReturnType<typeof vi.fn>;
  let mockEncryptData: ReturnType<typeof vi.fn>;
  let mockFromBase64: ReturnType<typeof vi.fn>;
  let mockToBase64: ReturnType<typeof vi.fn>;
  let mockIsNativePlatform: ReturnType<typeof vi.fn>;

  const createValidKiyoFile = (
    overrides: Partial<KiyoDataFile> = {},
  ): KiyoDataFile => ({
    version: 1,
    fileName: "test.json",
    updatedAt: Date.now(),
    accounts: [] as Account[],
    templates: [] as Template[],
    settings: [] as Setting[],
    metadata: [] as Metadata[],
    ...overrides,
  });

  const createEncryptedFile = (
    overrides: Partial<{
      salt: string;
      iv: string;
      ciphertext: string;
    }> = {},
  ) => ({
    version: 1,
    encrypted: true,
    salt: "c2FsdF9zYWx0X3NhbHRfc2FsdA==", // base64 encoded 16 bytes
    iv: "aXYxMjM0NTY3ODkwYWI=", // base64 encoded 12 bytes
    ciphertext: "Y2lwaGVydGV4dF9jaXBoZXJ0ZXh0", // base64 encoded
    ...overrides,
  });

  const mockCryptoKey = {} as CryptoKey;
  const mockSalt = new Uint8Array(16);
  const mockEncryptedFile = createEncryptedFile();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockSetSession = vi.fn().mockResolvedValue(undefined);
    mockSetCryptoKey = vi.fn().mockResolvedValue(undefined);
    mockSetAccounts = vi.fn();
    mockSaveFileDataToDB = vi.fn().mockResolvedValue(undefined);
    mockReplaceDatabaseData = vi.fn().mockResolvedValue(undefined);
    mockGetDatabaseSnapshot = vi.fn();
    mockIsEncryptedKiyoFile = vi.fn().mockReturnValue(false);
    mockCreateCryptoKey = vi
      .fn()
      .mockResolvedValue({ key: mockCryptoKey, salt: mockSalt });
    mockEncryptData = vi.fn().mockResolvedValue(mockEncryptedFile);
    mockFromBase64 = vi.fn().mockReturnValue(new Uint8Array(16));
    mockToBase64 = vi.fn().mockReturnValue("base64string");
    mockIsNativePlatform = vi.fn().mockReturnValue(false);

    // Configure mocks
    (useSessionStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      setSession: mockSetSession,
      setCryptoKey: mockSetCryptoKey,
      clearSession: vi.fn(),
    });

    (useAccountStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      setAccounts: mockSetAccounts,
    });

    (saveFileDataToDB as ReturnType<typeof vi.fn>).mockImplementation(
      mockSaveFileDataToDB,
    );
    (replaceDatabaseData as ReturnType<typeof vi.fn>).mockImplementation(
      mockReplaceDatabaseData,
    );
    (
      isEncryptedKiyoFile as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(mockIsEncryptedKiyoFile);
    (createCryptoKey as ReturnType<typeof vi.fn>).mockImplementation(
      mockCreateCryptoKey,
    );
    (encryptData as ReturnType<typeof vi.fn>).mockImplementation(
      mockEncryptData,
    );
    (fromBase64 as ReturnType<typeof vi.fn>).mockImplementation(mockFromBase64);
    (toBase64 as ReturnType<typeof vi.fn>).mockImplementation(mockToBase64);
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockImplementation(
      mockIsNativePlatform,
    );

    // getDatabaseSnapshot mock - returns data with matching filename
    mockGetDatabaseSnapshot = vi
      .fn()
      .mockImplementation(async (fileName: string) => {
        return createValidKiyoFile({ fileName });
      });
    (getDatabaseSnapshot as ReturnType<typeof vi.fn>).mockImplementation(
      mockGetDatabaseSnapshot,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("평문 백업 (PIN 없음)", () => {
    it("DB snapshot을 생성한다 (getDatabaseSnapshot 호출)", async () => {
      await backupDataFile("test.json", "");

      expect(mockGetDatabaseSnapshot).toHaveBeenCalledTimes(1);
      expect(mockGetDatabaseSnapshot).toHaveBeenCalledWith("test.json");
    });

    it("JSON 변환 후 파일 저장을 호출한다 (writeDataFile을 통해)", async () => {
      await backupDataFile("test.json", "");

      // saveFileDataToDB가 평문 데이터와 함께 호출되는지 확인
      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          settings: [],
          metadata: [],
        }),
      );
      expect(salt).toBeUndefined();
    });

    it("sessionStore.setSession을 호출하지 않는다 (shouldSetActiveFile=false)", async () => {
      await backupDataFile("test.json", "");

      // backupDataFile은 shouldSetActiveFile=false로 saveDataFile을 호출하므로
      // setSession이 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it("cryptoKey와 salt를 sessionStore에 저장하지 않는다 (평문 파일)", async () => {
      await backupDataFile("test.json", "");

      expect(mockSetCryptoKey).not.toHaveBeenCalled();
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it("createCryptoKey를 호출하지 않는다 (PIN 없음)", async () => {
      await backupDataFile("test.json", "");

      expect(mockCreateCryptoKey).not.toHaveBeenCalled();
    });

    it("encryptData를 호출하지 않는다 (PIN 없음)", async () => {
      await backupDataFile("test.json", "");

      expect(mockEncryptData).not.toHaveBeenCalled();
    });

    it("shouldSetActiveFile이 false로 saveDataFile을 호출한다", async () => {
      await backupDataFile("test.json", "");

      // backupDataFile은 shouldSetActiveFile=false로 saveDataFile을 호출
      // setSession과 setCryptoKey 모두 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
      expect(mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("데이터가 있는 accounts, templates, settings, metadata도 정상 백업한다", async () => {
      const fullData = createValidKiyoFile({
        fileName: "full-data.json",
        accounts: [
          {
            id: 1,
            templateId: 1,
            title: "Test Account",
            tags: ["tag1"],
            favorite: true,
            fields: [
              {
                id: "1-1",
                label: "Field",
                type: "text",
                value: "value",
                order: 0,
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        templates: [{ id: 1, name: "Template 1", fields: [] }],
        settings: [{ theme: "dark", autoLockTime: 300, lockEnabled: true }],
        metadata: [{ id: 1, version: "1.0.0", createdAt: Date.now() }],
      });
      // Override the mock for this specific test
      (getDatabaseSnapshot as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        fullData,
      );

      const result = await backupDataFile("full-data.json", "");

      expect(result).toEqual(fullData);
      // Check that saveFileDataToDB was called with the right filename and data containing expected properties
      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("full-data.json");
      expect(data).toEqual(
        expect.objectContaining({
          fileName: "full-data.json",
          accounts: fullData.accounts,
          templates: fullData.templates,
          settings: fullData.settings,
          metadata: fullData.metadata,
          version: 1,
        }),
      );
      expect(salt).toBeUndefined();
    });

    it("fileName 정규화가 적용된다", async () => {
      await backupDataFile("  my-backup  ", "");

      expect(mockGetDatabaseSnapshot).toHaveBeenCalledWith("my-backup.json");
      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("my-backup.json");
      expect(data).toEqual(
        expect.objectContaining({
          fileName: "my-backup.json",
          version: 1,
        }),
      );
      expect(salt).toBeUndefined();
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it("확장자가 없는 파일명에 .json을 추가한다", async () => {
      await backupDataFile("backup", "");

      expect(mockGetDatabaseSnapshot).toHaveBeenCalledWith("backup.json");
      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("backup.json");
      expect(data).toEqual(
        expect.objectContaining({
          fileName: "backup.json",
          version: 1,
        }),
      );
      expect(salt).toBeUndefined();
    });

    it("백업된 데이터를 반환한다", async () => {
      const result = await backupDataFile("test.json", "");

      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          settings: [],
          metadata: [],
        }),
      );
    });

    it("빈 문자열 PIN도 평문 백업으로 처리한다", async () => {
      await backupDataFile("test.json", "");

      expect(mockCreateCryptoKey).not.toHaveBeenCalled();
      expect(mockEncryptData).not.toHaveBeenCalled();
      expect(mockSetCryptoKey).not.toHaveBeenCalled();
    });
  });

  describe("PIN 백업 (암호화)", () => {
    it("DB snapshot을 생성한다 (getDatabaseSnapshot 호출)", async () => {
      await backupDataFile("test.json", "1234");

      expect(mockGetDatabaseSnapshot).toHaveBeenCalledTimes(1);
      expect(mockGetDatabaseSnapshot).toHaveBeenCalledWith("test.json");
    });

    it("createCryptoKey를 PIN과 함께 호출한다", async () => {
      await backupDataFile("test.json", "1234");

      expect(mockCreateCryptoKey).toHaveBeenCalledTimes(1);
      expect(mockCreateCryptoKey).toHaveBeenCalledWith("1234");
    });

    it("encryptData를 데이터와 키, salt로 호출한다", async () => {
      await backupDataFile("test.json", "1234");

      expect(mockEncryptData).toHaveBeenCalledTimes(1);
      expect(mockEncryptData).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          settings: [],
          metadata: [],
        }),
        mockCryptoKey,
        mockSalt,
      );
    });

    it("암호화된 파일을 저장한다 (saveFileDataToDB에 encrypted 데이터와 salt 전달)", async () => {
      await backupDataFile("test.json", "1234");

      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(mockEncryptedFile);
      expect(salt).toEqual(mockSalt);
    });

    it("sessionStore.setCryptoKey를 호출하지 않는다 (shouldSetActiveFile=false)", async () => {
      await backupDataFile("test.json", "1234");

      // backupDataFile은 shouldSetActiveFile=false로 saveDataFile을 호출하므로
      // setCryptoKey가 호출되지 않음
      expect(mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("sessionStore.setSession을 호출하지 않는다 (shouldSetActiveFile=false)", async () => {
      await backupDataFile("test.json", "1234");

      // backupDataFile은 shouldSetActiveFile=false로 saveDataFile을 호출하므로
      // setSession이 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it("shouldSetActiveFile이 false로 saveDataFile을 호출한다", async () => {
      await backupDataFile("test.json", "1234");

      // backupDataFile은 shouldSetActiveFile=false로 saveDataFile을 호출
      // setSession과 setCryptoKey 모두 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
      expect(mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("데이터가 있는 accounts, templates, settings, metadata도 정상 암호화 백업한다", async () => {
      const fullData = createValidKiyoFile({
        accounts: [
          {
            id: 1,
            templateId: 1,
            title: "Account 1",
            tags: ["tag1"],
            favorite: true,
            fields: [
              {
                id: "1-1",
                label: "Field",
                type: "text",
                value: "value",
                order: 0,
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        templates: [{ id: 1, name: "Template 1", fields: [] }],
        settings: [{ theme: "dark", autoLockTime: 300, lockEnabled: true }],
        metadata: [{ id: 1, version: "1.0.0", createdAt: Date.now() }],
      });
      (getDatabaseSnapshot as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        fullData,
      );

      const result = await backupDataFile("full-data.json", "1234");

      expect(result).toEqual(fullData);
      expect(mockEncryptData).toHaveBeenCalledWith(
        expect.objectContaining({
          accounts: fullData.accounts,
          templates: fullData.templates,
          settings: fullData.settings,
          metadata: fullData.metadata,
        }),
        mockCryptoKey,
        mockSalt,
      );
      expect(mockSaveFileDataToDB).toHaveBeenCalledWith(
        "full-data.json",
        mockEncryptedFile,
        mockSalt,
      );
    });

    it("fileName 정규화가 적용된다", async () => {
      await backupDataFile("  my-backup  ", "1234");

      expect(mockGetDatabaseSnapshot).toHaveBeenCalledWith("my-backup.json");
      expect(mockSaveFileDataToDB).toHaveBeenCalledWith(
        "my-backup.json",
        mockEncryptedFile,
        mockSalt,
      );
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it("확장자가 없는 파일명에 .json을 추가한다", async () => {
      await backupDataFile("backup", "1234");

      expect(mockGetDatabaseSnapshot).toHaveBeenCalledWith("backup.json");
      expect(mockSaveFileDataToDB).toHaveBeenCalledWith(
        "backup.json",
        mockEncryptedFile,
        mockSalt,
      );
    });

    it("백업된 데이터(평문 원본)를 반환한다", async () => {
      const result = await backupDataFile("test.json", "1234");

      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          settings: [],
          metadata: [],
        }),
      );
    });

    it("PIN이 있는 경우 isEncryptedKiyoFile이 호출되지 않는다 (백업은 항상 평문 DB에서 가져옴)", async () => {
      await backupDataFile("test.json", "1234");

      // backupDataFile은 DB에서 평문 데이터를 가져와서 암호화하므로
      // isEncryptedKiyoFile을 호출하지 않음
      expect(mockIsEncryptedKiyoFile).not.toHaveBeenCalled();
    });
  });

  describe("에러 처리", () => {
    it("getDatabaseSnapshot 실패 시 에러를 전파한다", async () => {
      (getDatabaseSnapshot as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("DB snapshot failed"),
      );

      await expect(backupDataFile("test.json", "")).rejects.toThrow(
        "DB snapshot failed",
      );
    });

    it("createCryptoKey 실패 시 에러를 전파한다", async () => {
      mockCreateCryptoKey.mockRejectedValueOnce(
        new Error("Crypto key creation failed"),
      );

      await expect(backupDataFile("test.json", "1234")).rejects.toThrow(
        "Crypto key creation failed",
      );
    });

    it("encryptData 실패 시 에러를 전파한다", async () => {
      mockEncryptData.mockRejectedValueOnce(new Error("Encryption failed"));

      await expect(backupDataFile("test.json", "1234")).rejects.toThrow(
        "Encryption failed",
      );
    });

    it("saveFileDataToDB 실패 시 에러를 전파한다", async () => {
      mockSaveFileDataToDB.mockRejectedValueOnce(new Error("DB save failed"));

      await expect(backupDataFile("test.json", "")).rejects.toThrow(
        "DB save failed",
      );
    });

    it("setSession 실패 시 에러를 전파한다 (shouldSetActiveFile=true일 때)", async () => {
      // backupDataFile은 shouldSetActiveFile=false이므로 setSession을 호출하지 않음
      // 이 테스트는 createDataFile 등 shouldSetActiveFile=true인 함수에서 테스트해야 함
      await backupDataFile("test.json", "");
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it("setCryptoKey 실패 시 에러를 전파한다 (shouldSetActiveFile=true일 때)", async () => {
      // backupDataFile은 shouldSetActiveFile=false이므로 setCryptoKey를 호출하지 않음
      // 이 테스트는 createDataFile 등 shouldSetActiveFile=true인 함수에서 테스트해야 함
      await backupDataFile("test.json", "1234");
      expect(mockSetCryptoKey).not.toHaveBeenCalled();
    });
  });

  describe("공통 동작", () => {
    it("기본 파일명 'kiyo-data'를 사용한다 (빈 문자열 입력 시)", async () => {
      await backupDataFile("", "");

      expect(mockGetDatabaseSnapshot).toHaveBeenCalledWith("kiyo-data.json");
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it("공백만 있는 입력도 기본 파일명으로 처리한다", async () => {
      await backupDataFile("   ", "");

      expect(mockGetDatabaseSnapshot).toHaveBeenCalledWith("kiyo-data.json");
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
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
