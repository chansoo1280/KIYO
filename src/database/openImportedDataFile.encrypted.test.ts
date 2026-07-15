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
import { openImportedDataFile, type KiyoDataFile } from "./fileStorage";
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
  let mockSetSession: ReturnType<typeof vi.fn>;
  let mockSetAccounts: ReturnType<typeof vi.fn>;
  let mockSaveFileDataToDB: ReturnType<typeof vi.fn>;
  let mockReplaceDatabaseData: ReturnType<typeof vi.fn>;
  let mockIsEncryptedKiyoFile: ReturnType<typeof vi.fn>;
  let mockCreateCryptoKey: ReturnType<typeof vi.fn>;
  let mockDecryptData: ReturnType<typeof vi.fn>;
  let mockFromBase64: ReturnType<typeof vi.fn>;
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

  const validJsonString = JSON.stringify(createValidKiyoFile());
  const encryptedFile = createEncryptedFile();
  const encryptedJsonString = JSON.stringify(encryptedFile);
  const mockCryptoKey = {} as CryptoKey;
  const mockSalt = new Uint8Array(16);
  const mockDecryptedData = createValidKiyoFile();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockSetSession = vi.fn().mockResolvedValue(undefined);
    mockSetAccounts = vi.fn();
    mockSaveFileDataToDB = vi.fn().mockResolvedValue(undefined);
    mockReplaceDatabaseData = vi.fn().mockResolvedValue(undefined);
    mockIsEncryptedKiyoFile = vi.fn().mockReturnValue(true); // 암호화 파일로 인식
    mockCreateCryptoKey = vi
      .fn()
      .mockResolvedValue({ key: mockCryptoKey, salt: mockSalt });
    mockDecryptData = vi.fn().mockResolvedValue(mockDecryptedData);
    mockFromBase64 = vi.fn().mockReturnValue(new Uint8Array(16));
    mockIsNativePlatform = vi.fn().mockReturnValue(false);

    // Configure mocks
    (useSessionStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      setSession: mockSetSession,
      setCryptoKey: vi.fn(),
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
    (decryptData as ReturnType<typeof vi.fn>).mockImplementation(
      mockDecryptData,
    );
    (fromBase64 as ReturnType<typeof vi.fn>).mockImplementation(mockFromBase64);
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockImplementation(
      mockIsNativePlatform,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
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
      expect(mockIsEncryptedKiyoFile).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          encrypted: true,
        }),
      );

      // fromBase64로 salt 디코딩 확인
      expect(mockFromBase64).toHaveBeenCalledWith(encryptedFile.salt);

      // createCryptoKey 호출 확인
      expect(mockCreateCryptoKey).toHaveBeenCalledWith(
        "1234",
        expect.any(Uint8Array),
      );

      // decryptData 호출 확인
      expect(mockDecryptData).toHaveBeenCalledWith(
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
      expect(mockReplaceDatabaseData).toHaveBeenCalledTimes(1);
      expect(mockReplaceDatabaseData).toHaveBeenCalledWith(mockDecryptedData);

      // setSession 호출 확인 (fileName, cryptoKey, salt 전달)
      expect(mockSetSession).toHaveBeenCalledTimes(1);
      const callArgs = mockSetSession.mock.calls[0][0];
      expect(callArgs).toEqual(
        expect.objectContaining({
          fileName: "test.json",
          cryptoKey: mockCryptoKey,
          salt: mockSalt,
        }),
      );

      // saveFileDataToDB 호출 확인 (암호화된 데이터와 salt)
      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(encryptedFile);
      expect(salt).toEqual(mockSalt);

      // setAccounts 호출 확인
      expect(mockSetAccounts).toHaveBeenCalledTimes(1);
      expect(mockSetAccounts).toHaveBeenCalledWith([]);
    });

    it("데이터가 있는 accounts도 정상 처리한다", async () => {
      const decryptedWithAccounts = createValidKiyoFile({
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
      });
      mockDecryptData.mockResolvedValueOnce(decryptedWithAccounts);

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).not.toBeNull();
      expect(result!.accounts).toHaveLength(1);
      expect(mockReplaceDatabaseData).toHaveBeenCalledWith(
        expect.objectContaining({
          accounts: decryptedWithAccounts.accounts,
        }),
      );
      expect(mockSetAccounts).toHaveBeenCalledWith(
        decryptedWithAccounts.accounts,
      );
    });

    it("isEncryptedKiyoFile이 false면 평문 로직으로 분기한다", async () => {
      mockIsEncryptedKiyoFile.mockReturnValueOnce(false);

      const result = await openImportedDataFile(validJsonString, "");

      expect(result).not.toBeNull();
      expect(mockCreateCryptoKey).not.toHaveBeenCalled();
      expect(mockDecryptData).not.toHaveBeenCalled();
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

      for (const { desc, salt, mockSalt } of saltTestCases) {
        vi.clearAllMocks();

        // Setup mocks for each iteration
        mockSetSession = vi.fn().mockResolvedValue(undefined);
        mockSetAccounts = vi.fn();
        mockSaveFileDataToDB = vi.fn().mockResolvedValue(undefined);
        mockReplaceDatabaseData = vi.fn().mockResolvedValue(undefined);
        mockIsEncryptedKiyoFile = vi.fn().mockReturnValue(true);
        mockCreateCryptoKey = vi
          .fn()
          .mockResolvedValue({
            key: mockCryptoKey,
            salt: mockSalt || new Uint8Array(16),
          });
        mockDecryptData = vi.fn().mockResolvedValue(mockDecryptedData);
        mockFromBase64 = vi
          .fn()
          .mockReturnValue(mockSalt || new Uint8Array(16));
        mockIsNativePlatform = vi.fn().mockReturnValue(false);

        (useSessionStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
          setSession: mockSetSession,
          setCryptoKey: vi.fn(),
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
        (decryptData as ReturnType<typeof vi.fn>).mockImplementation(
          mockDecryptData,
        );
        (fromBase64 as ReturnType<typeof vi.fn>).mockImplementation(
          mockFromBase64,
        );
        (
          Capacitor.isNativePlatform as ReturnType<typeof vi.fn>
        ).mockImplementation(mockIsNativePlatform);

        const file = createEncryptedFile({ salt });
        const jsonString = JSON.stringify(file);

        const result = await openImportedDataFile(jsonString, "1234");

        expect(result).toBeNull();
        expect(mockCreateCryptoKey).not.toHaveBeenCalled();
        expect(mockDecryptData).not.toHaveBeenCalled();
      }
    });

    it("createCryptoKey 실패 시 null을 반환한다", async () => {
      mockCreateCryptoKey.mockRejectedValueOnce(
        new Error("Key creation failed"),
      );

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
      expect(mockDecryptData).not.toHaveBeenCalled();
    });

    it("decryptData 실패 시 null을 반환한다 (잘못된 PIN)", async () => {
      mockDecryptData.mockRejectedValueOnce(new Error("Decryption failed"));

      const result = await openImportedDataFile(
        encryptedJsonString,
        "wrong-pin",
      );

      expect(result).toBeNull();
      expect(mockReplaceDatabaseData).not.toHaveBeenCalled();
      // setSession은 decryptData 이후에 호출되므로 decryptData 실패 시 호출되지 않음
      expect(mockSetSession).not.toHaveBeenCalled();
      expect(mockSaveFileDataToDB).not.toHaveBeenCalled();
      expect(mockSetAccounts).not.toHaveBeenCalled();
    });

    it("복호화된 데이터가 isKiyoFile 검증 실패 시 null을 반환한다", async () => {
      // fileName이 있는 유효하지 않은 데이터로 mock 설정 (normalizeDataFileName에서 에러 방지)
      mockDecryptData.mockResolvedValueOnce({
        invalid: "data",
        fileName: "test.json",
      });

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
      expect(mockReplaceDatabaseData).not.toHaveBeenCalled();
      // setSession은 decryptData 이후, isKiyoFile 검증 이전에 호출되므로 호출됨
      expect(mockSetSession).toHaveBeenCalled();
      expect(mockSaveFileDataToDB).not.toHaveBeenCalled();
      expect(mockSetAccounts).not.toHaveBeenCalled();
    });

    it("replaceDatabaseData 실패 시 null을 반환한다", async () => {
      mockReplaceDatabaseData.mockRejectedValueOnce(new Error("DB error"));

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
      // setSession은 replaceDatabaseData 이전에 호출되므로 호출됨
      expect(mockSetSession).toHaveBeenCalled();
      expect(mockSaveFileDataToDB).not.toHaveBeenCalled();
      expect(mockSetAccounts).not.toHaveBeenCalled();
    });

    it("saveFileDataToDB 실패 시 null을 반환한다", async () => {
      mockSaveFileDataToDB.mockRejectedValueOnce(new Error("DB save failed"));

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
    });

    it("setSession 실패 시 null을 반환한다", async () => {
      mockSetSession.mockRejectedValueOnce(new Error("Session error"));

      const result = await openImportedDataFile(encryptedJsonString, "1234");

      expect(result).toBeNull();
    });

    it("JSON 파싱 실패 또는 평문 파일 분기 시 null을 반환한다", async () => {
      // JSON 파싱 실패
      const invalidJson = "{ invalid json }";
      let result = await openImportedDataFile(invalidJson, "1234");
      expect(result).toBeNull();
      expect(mockIsEncryptedKiyoFile).not.toHaveBeenCalled();

      // isEncryptedKiyoFile이 false 반환 (평문 로직으로 분기)
      vi.clearAllMocks();
      mockIsEncryptedKiyoFile = vi.fn().mockReturnValue(false);
      mockSetSession = vi.fn().mockResolvedValue(undefined);
      mockSetAccounts = vi.fn();
      mockSaveFileDataToDB = vi.fn().mockResolvedValue(undefined);
      mockReplaceDatabaseData = vi.fn().mockResolvedValue(undefined);
      mockIsNativePlatform = vi.fn().mockReturnValue(false);

      (useSessionStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
        setSession: mockSetSession,
        setCryptoKey: vi.fn(),
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
      (
        Capacitor.isNativePlatform as ReturnType<typeof vi.fn>
      ).mockImplementation(mockIsNativePlatform);

      result = await openImportedDataFile(validJsonString, "");
      expect(result).not.toBeNull();
      expect(mockCreateCryptoKey).not.toHaveBeenCalled();
      expect(mockDecryptData).not.toHaveBeenCalled();
    });
  });
});
