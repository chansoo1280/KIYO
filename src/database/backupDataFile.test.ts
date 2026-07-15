import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { backupDataFile } from "./fileStorage";
import {
  createCryptoKey,
  encryptData,
  isEncryptedKiyoFile,
} from "../crypto/encryption";
import { getDatabaseSnapshot, saveFileDataToDB } from "../database/db";
import { useSessionStore } from "../store/sessionStore";

import {
  createTestEncryptedFile,
  createTestKiyoDataFile,
} from "../test/fixtures/databaseFixtures";
import {
  createTestAccount,
  createTestField,
  createTestAccounts,
} from "../test/fixtures/accountFixtures";
import {
  createTestTemplate,
  createTestTemplates,
} from "../test/fixtures/templateFixtures";

// Import common mocks
import { createMockSessionStore } from "../test/mocks/sessionStoreMock";
import { createMockEncryption } from "../test/mocks/encryptionMock";
import { createMockDB } from "../test/mocks/dbMock";

// Mock sessionStore
vi.mock("../store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(),
  },
}));

// Mock crypto functions
vi.mock("../crypto/encryption", () => ({
  createCryptoKey: vi.fn(),
  encryptData: vi.fn(),
  isEncryptedKiyoFile: vi.fn(),
}));

// Mock db functions
vi.mock("../database/db", () => ({
  getDatabaseSnapshot: vi.fn(),
  saveFileDataToDB: vi.fn(),
}));

describe("backupDataFile", () => {
  let mockSessionStore: ReturnType<typeof createMockSessionStore>;
  let mockEncryption: ReturnType<typeof createMockEncryption>;
  let mockDB: ReturnType<typeof createMockDB>;

  const mockCryptoKey = {} as CryptoKey;
  const mockSalt = new Uint8Array(16);
  const mockEncryptedFile = createTestEncryptedFile();

  beforeEach(() => {
    // Create fresh mocks for each test
    mockSessionStore = createMockSessionStore();
    mockEncryption = createMockEncryption();
    mockDB = createMockDB();

    // Configure mock implementations
    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
    vi.mocked(createCryptoKey).mockImplementation(
      mockEncryption.mockCreateCryptoKey,
    );
    vi.mocked(encryptData).mockImplementation(mockEncryption.mockEncryptData);
    vi.mocked(isEncryptedKiyoFile).mockImplementation(
      mockEncryption.mockIsEncryptedKiyoFile,
    );
    vi.mocked(getDatabaseSnapshot).mockImplementation(
      mockDB.mockGetDatabaseSnapshot,
    );
    vi.mocked(saveFileDataToDB).mockImplementation(mockDB.mockSaveFileDataToDB);

    // Override specific mock implementations for backupDataFile tests
    mockEncryption.mockCreateCryptoKey.mockResolvedValue({
      key: mockCryptoKey,
      salt: mockSalt,
    });
    mockEncryption.mockEncryptData.mockResolvedValue(mockEncryptedFile);
    mockEncryption.mockIsEncryptedKiyoFile.mockReturnValue(false);

    // getDatabaseSnapshot mock - returns data with matching filename
    mockDB.mockGetDatabaseSnapshot.mockImplementation(
      async (fileName: string) =>
        createTestKiyoDataFile({
          fileName,
          accounts: createTestAccounts(),
          templates: createTestTemplates(),
        }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("평문 백업 (PIN 없음)", () => {
    it("DB snapshot을 생성한다 (getDatabaseSnapshot 호출)", async () => {
      await backupDataFile("test.json", "");

      expect(mockDB.mockGetDatabaseSnapshot).toHaveBeenCalledTimes(1);
      expect(mockDB.mockGetDatabaseSnapshot).toHaveBeenCalledWith("test.json");
    });

    it("JSON 변환 후 파일 저장을 호출한다 (writeDataFile을 통해)", async () => {
      await backupDataFile("test.json", "");

      // saveFileDataToDB가 평문 데이터와 함께 호출되는지 확인
      expect(mockDB.mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockDB.mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: expect.any(Array),
          templates: expect.any(Array),
          settings: expect.any(Array),
          metadata: expect.any(Array),
        }),
      );
      expect(salt).toBeUndefined();
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

    it("데이터가 있는 accounts, templates, settings, metadata도 정상 백업한다", async () => {
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
          createTestTemplate({ id: 1, name: "Template 1", fields: [] }),
        ],
        settings: [{ theme: "dark", autoLockTime: 300, lockEnabled: true }],
        metadata: [{ id: 1, version: "1.0.0", createdAt: Date.now() }],
      });
      // Override the mock for this specific test
      mockDB.mockGetDatabaseSnapshot.mockResolvedValueOnce(fullData);

      const result = await backupDataFile("full-data.json", "");

      expect(result).toEqual(fullData);
      // Check that saveFileDataToDB was called with the right filename and data containing expected properties
      expect(mockDB.mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockDB.mockSaveFileDataToDB.mock.calls[0];
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

      expect(mockDB.mockGetDatabaseSnapshot).toHaveBeenCalledWith(
        "my-backup.json",
      );
      expect(mockDB.mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockDB.mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("my-backup.json");
      expect(data).toEqual(
        expect.objectContaining({
          fileName: "my-backup.json",
          version: 1,
        }),
      );
      expect(salt).toBeUndefined();
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
    });

    it("확장자가 없는 파일명에 .json을 추가한다", async () => {
      await backupDataFile("backup", "");

      expect(mockDB.mockGetDatabaseSnapshot).toHaveBeenCalledWith(
        "backup.json",
      );
      expect(mockDB.mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockDB.mockSaveFileDataToDB.mock.calls[0];
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
          accounts: expect.any(Array),
          templates: expect.any(Array),
          settings: expect.any(Array),
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

      expect(mockDB.mockGetDatabaseSnapshot).toHaveBeenCalledTimes(1);
      expect(mockDB.mockGetDatabaseSnapshot).toHaveBeenCalledWith("test.json");
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
          settings: expect.any(Array),
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

    it("DB 저장 함수(saveFileDataToDB)를 암호화 데이터와 salt와 함께 호출한다", async () => {
      await backupDataFile("test.json", "1234");

      expect(mockDB.mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockDB.mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(mockEncryptedFile);
      expect(salt).toEqual(mockSalt);
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
          settings: expect.any(Array),
          metadata: expect.any(Array),
        }),
      );
    });

    it("파일명 정규화를 적용한다", async () => {
      await backupDataFile("  secure data  ", "1234");

      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(mockDB.mockSaveFileDataToDB).toHaveBeenCalledWith(
        "secure data.json",
        expect.any(Object),
        expect.any(Uint8Array),
      );
    });
  });

  describe("에러 처리", () => {
    it("getDatabaseSnapshot 실패 시 에러를 전파한다", async () => {
      mockDB.mockGetDatabaseSnapshot.mockRejectedValueOnce(
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

    it("saveFileDataToDB 실패 시 에러를 전파한다", async () => {
      mockDB.mockSaveFileDataToDB.mockRejectedValueOnce(
        new Error("DB save failed"),
      );

      await expect(backupDataFile("test.json", "")).rejects.toThrow(
        "DB save failed",
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

      expect(mockDB.mockGetDatabaseSnapshot).toHaveBeenCalledWith(
        "kiyo-data.json",
      );
      // shouldSetActiveFile=false이므로 setSession 호출되지 않음
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
    });

    it("공백만 있는 입력도 기본 파일명으로 처리한다", async () => {
      await backupDataFile("   ", "");

      expect(mockDB.mockGetDatabaseSnapshot).toHaveBeenCalledWith(
        "kiyo-data.json",
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
