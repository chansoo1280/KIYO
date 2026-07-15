import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { useSessionStore } from "../store/sessionStore";
import { useAccountStore } from "../store/accountStore";
import {
  createCryptoKey,
  encryptData,
  type EncryptedKiyoFile,
} from "../crypto/encryption";
import { saveFileDataToDB } from "./db";
import { createDataFile } from "./fileStorage";

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

// Mock crypto functions
vi.mock("../crypto/encryption", () => ({
  createCryptoKey: vi.fn(),
  encryptData: vi.fn(),
  decryptData: vi.fn(),
  isEncryptedKiyoFile: vi.fn(),
  fromBase64: vi.fn(),
}));

// Mock db functions
vi.mock("./db", () => ({
  saveFileDataToDB: vi.fn(),
  getDatabaseSnapshot: vi.fn(),
  replaceDatabaseData: vi.fn(),
  loadAccountsFromDB: vi.fn(),
  isNativeFileStorageAvailable: vi.fn(() => false),
}));

describe("createDataFile", () => {
  let mockSetSession: ReturnType<typeof vi.fn>;
  let mockSetCryptoKey: ReturnType<typeof vi.fn>;
  let mockSetAccounts: ReturnType<typeof vi.fn>;
  let mockSaveFileDataToDB: ReturnType<typeof vi.fn>;
  let mockCreateCryptoKey: ReturnType<typeof vi.fn>;
  let mockEncryptData: ReturnType<typeof vi.fn>;
  let mockIsNativePlatform: ReturnType<typeof vi.fn>;

  const mockCryptoKey = {} as CryptoKey;
  const mockSalt = new Uint8Array(16);
  const mockEncryptedData: EncryptedKiyoFile = {
    version: 1,
    encrypted: true,
    salt: "base64salt",
    iv: "base64iv",
    ciphertext: "base64ciphertext",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockSetSession = vi.fn().mockResolvedValue(undefined);
    mockSetCryptoKey = vi.fn().mockResolvedValue(undefined);
    mockSetAccounts = vi.fn();
    mockSaveFileDataToDB = vi.fn().mockResolvedValue(undefined);
    mockCreateCryptoKey = vi
      .fn()
      .mockResolvedValue({ key: mockCryptoKey, salt: mockSalt });
    mockEncryptData = vi.fn().mockResolvedValue(mockEncryptedData);
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
    (createCryptoKey as ReturnType<typeof vi.fn>).mockImplementation(
      mockCreateCryptoKey,
    );
    (encryptData as ReturnType<typeof vi.fn>).mockImplementation(
      mockEncryptData,
    );
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockImplementation(
      mockIsNativePlatform,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("PIN 없는 파일 생성", () => {
    it("평문 KiyoDataFile을 생성한다", async () => {
      const result = await createDataFile("test-file");

      expect(result).toBeDefined();
      expect(result.version).toBe(1);
      expect(result.fileName).toBe("test-file.json");
      expect(result.accounts).toEqual([]);
      expect(result.templates).toEqual([]);
      expect(result.settings).toEqual([]);
      expect(result.metadata).toEqual([]);
      expect(typeof result.updatedAt).toBe("number");
    });

    it("encrypted가 없는 평문 파일을 생성한다", async () => {
      const result = await createDataFile("test-file");

      // 결과가 평문 KiyoDataFile인지 확인 (encrypted 속성이 없음)
      expect("encrypted" in result).toBe(false);
    });

    it("sessionStore.setSession을 fileName과 함께 호출한다", async () => {
      await createDataFile("test-file");

      expect(mockSetSession).toHaveBeenCalledTimes(1);
      expect(mockSetSession).toHaveBeenCalledWith({
        fileName: "test-file.json",
      });
    });

    it("sessionStore.setSession에 cryptoKey와 salt를 전달하지 않는다", async () => {
      await createDataFile("test-file");

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "test-file.json",
        }),
      );
      // cryptoKey와 salt가 전달되지 않았는지 확인 (undefined가 아닌 아예 없음)
      const callArgs = mockSetSession.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("cryptoKey");
      expect(callArgs).not.toHaveProperty("salt");
    });

    it("DB 저장 함수(saveFileDataToDB)를 평문 데이터와 함께 호출한다", async () => {
      await createDataFile("test-file");

      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test-file.json");
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test-file.json",
          accounts: [],
          templates: [],
          settings: [],
          metadata: [],
        }),
      );
      expect(salt).toBeUndefined();
    });

    it("파일명 정규화를 적용한다 (공백 제거, .json 추가)", async () => {
      await createDataFile("  my data  ");

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "my data.json" }),
      );
      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("my data.json");
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "my data.json",
          accounts: [],
          templates: [],
          settings: [],
          metadata: [],
        }),
      );
      expect(typeof data.updatedAt).toBe("number");
      expect(salt).toBeUndefined();
    });

    it("이미 .json이 있는 파일명은 그대로 사용한다", async () => {
      await createDataFile("data.json");

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "data.json" }),
      );
    });
  });

  describe("PIN 있는 파일 생성", () => {
    it("createCryptoKey를 PIN과 함께 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockCreateCryptoKey).toHaveBeenCalledTimes(1);
      expect(mockCreateCryptoKey).toHaveBeenCalledWith("1234");
    });

    it("AES 암호화 파일(EncryptedKiyoFile)을 생성한다", async () => {
      const result = await createDataFile("test-file", "1234");

      // 결과는 평문 데이터지만, 내부적으로 암호화된 파일이 저장됨
      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test-file.json",
          accounts: [],
          templates: [],
          settings: [],
          metadata: [],
        }),
      );
    });

    it("sessionStore.setSession을 fileName, cryptoKey, salt와 함께 호출한다", async () => {
      await createDataFile("test-file", "1234");

      // PIN이 있는 경우 setSession이 fileName, cryptoKey, salt와 함께 호출됨
      expect(mockSetSession).toHaveBeenCalledTimes(1);
      expect(mockSetSession).toHaveBeenCalledWith({
        fileName: "test-file.json",
        cryptoKey: mockCryptoKey,
        salt: mockSalt,
      });
      // setCryptoKey는 더 이상 호출되지 않음
      expect(mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("DB 저장 함수(saveFileDataToDB)를 암호화 데이터와 salt와 함께 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test-file.json");
      expect(data).toEqual(mockEncryptedData);
      expect(salt).toEqual(mockSalt);
    });

    it("encryptData를 생성된 cryptoKey와 salt로 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockEncryptData).toHaveBeenCalledTimes(1);
      const [data, key, salt] = mockEncryptData.mock.calls[0];
      expect(key).toBe(mockCryptoKey);
      expect(salt).toEqual(mockSalt);
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test-file.json",
          accounts: [],
          templates: [],
          settings: [],
          metadata: [],
        }),
      );
    });

    it("파일명 정규화를 적용한다", async () => {
      await createDataFile("  secure data  ", "1234");

      expect(mockSetSession).toHaveBeenCalledWith({
        fileName: "secure data.json",
        cryptoKey: mockCryptoKey,
        salt: mockSalt,
      });
      expect(mockSaveFileDataToDB).toHaveBeenCalledWith(
        "secure data.json",
        expect.any(Object),
        expect.any(Uint8Array),
      );
    });
  });

  describe("공통 동작", () => {
    it("기본 파일명 'kiyo-data'를 사용한다 (빈 문자열 입력 시)", async () => {
      await createDataFile("");

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "kiyo-data.json" }),
      );
    });

    it("공백만 있는 입력도 기본 파일명으로 처리한다", async () => {
      await createDataFile("   ");

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "kiyo-data.json" }),
      );
    });

    it("생성된 데이터의 updatedAt이 현재 시간 근처인지 확인한다", async () => {
      const before = Date.now();
      const result = await createDataFile("test-file");
      const after = Date.now();

      expect(result.updatedAt).toBeGreaterThanOrEqual(before);
      expect(result.updatedAt).toBeLessThanOrEqual(after);
    });

    it("반환값은 항상 평문 KiyoDataFile이다 (PIN 유무와 관계없이)", async () => {
      const plainResult = await createDataFile("plain-file");
      const encryptedResult = await createDataFile("encrypted-file", "1234");

      expect("encrypted" in plainResult).toBe(false);
      expect("encrypted" in encryptedResult).toBe(false);
      expect(plainResult.version).toBe(1);
      expect(encryptedResult.version).toBe(1);
    });
  });

  describe("에러 처리", () => {
    it("createCryptoKey 실패 시 에러를 전파한다", async () => {
      mockCreateCryptoKey.mockRejectedValueOnce(
        new Error("Crypto key creation failed"),
      );

      await expect(createDataFile("test-file", "1234")).rejects.toThrow(
        "Crypto key creation failed",
      );
    });

    it("encryptData 실패 시 에러를 전파한다", async () => {
      mockEncryptData.mockRejectedValueOnce(new Error("Encryption failed"));

      await expect(createDataFile("test-file", "1234")).rejects.toThrow(
        "Encryption failed",
      );
    });

    it("saveFileDataToDB 실패 시 에러를 전파한다", async () => {
      mockSaveFileDataToDB.mockRejectedValueOnce(new Error("DB save failed"));

      await expect(createDataFile("test-file")).rejects.toThrow(
        "DB save failed",
      );
    });

    it("setSession 실패 시 에러를 전파한다", async () => {
      mockSetSession.mockRejectedValueOnce(new Error("Session set failed"));

      await expect(createDataFile("test-file")).rejects.toThrow(
        "Session set failed",
      );
    });
  });
});
