import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { useSessionStore } from "../store/sessionStore";
import { useAccountStore } from "../store/accountStore";
import { isEncryptedKiyoFile } from "../crypto/encryption";
import { saveFileDataToDB, replaceDatabaseData } from "./db";
import {
  openImportedDataFile,
  isKiyoFile,
  type KiyoDataFile,
} from "./fileStorage";
import type { Account, Template, Metadata } from "../models/account";

// Mock Capacitor
vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn(() => ({
    isAutofillEnabled: vi.fn().mockResolvedValue({
      enabled: false,
      hasService: false,
      servicePackageName: null,
    }),
    getAutofillServiceInfo: vi.fn().mockResolvedValue({
      isEnabled: false,
      isOurService: false,
      servicePackageName: null,
    }),
    requestAutofillEnable: vi.fn().mockResolvedValue(undefined),
    getAccountCount: vi.fn().mockResolvedValue({ count: 0 }),
    syncAccountsFromReact: vi
      .fn()
      .mockResolvedValue({ success: true, syncedCount: 0, errorCount: 0 }),
    syncAccounts: vi
      .fn()
      .mockResolvedValue({ syncedCount: 0, errorCount: 0, totalProcessed: 0 }),
    getAccounts: vi.fn().mockResolvedValue({ accounts: [], count: 0 }),
    addAccount: vi.fn().mockResolvedValue({ id: 1, success: true }),
    updateAccount: vi.fn().mockResolvedValue({ updated: true, id: 1 }),
    deleteAccount: vi.fn().mockResolvedValue({ deleted: true, id: 1 }),
    toggleFavorite: vi.fn().mockResolvedValue({ success: true, id: 1 }),
    clearAllAccounts: vi
      .fn()
      .mockResolvedValue({ deletedCount: 0, success: true }),
  })),
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => "web"),
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

// Mock isEncryptedKiyoFile to always return false (plain file tests only)
vi.mock("../crypto/encryption", () => ({
  isEncryptedKiyoFile: vi.fn(() => false) as unknown as ReturnType<
    typeof vi.fn
  >,
  createCryptoKey: vi.fn(),
  encryptData: vi.fn(),
  decryptData: vi.fn(),
  fromBase64: vi.fn(),
}));

// Mock db functions
vi.mock("./db", () => ({
  saveFileDataToDB: vi.fn(),
  replaceDatabaseData: vi.fn(),
  getDatabaseSnapshot: vi.fn(),
  loadAccountsFromDB: vi.fn(),
  isNativeFileStorageAvailable: vi.fn(() => false),
}));

describe("openImportedDataFile", () => {
  let mockSetSession: ReturnType<typeof vi.fn>;
  let mockSetAccounts: ReturnType<typeof vi.fn>;
  let mockSaveFileDataToDB: ReturnType<typeof vi.fn>;
  let mockReplaceDatabaseData: ReturnType<typeof vi.fn>;
  let mockIsEncryptedKiyoFile: ReturnType<typeof vi.fn>;
  let mockIsNativePlatform: ReturnType<typeof vi.fn>;

  const createValidKiyoFile = (
    overrides: Partial<KiyoDataFile> = {},
  ): KiyoDataFile => ({
    version: 1,
    fileName: "test.json",
    updatedAt: Date.now(),
    accounts: [] as Account[],
    templates: [] as Template[],
    metadata: [] as Metadata[],
    ...overrides,
  });

  const validJsonString = JSON.stringify(createValidKiyoFile());

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockSetSession = vi.fn().mockResolvedValue(undefined);
    mockSetAccounts = vi.fn();
    mockSaveFileDataToDB = vi.fn().mockResolvedValue(undefined);
    mockReplaceDatabaseData = vi.fn().mockResolvedValue(undefined);
    mockIsEncryptedKiyoFile = vi.fn().mockReturnValue(false);
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
    (Capacitor.isNativePlatform as ReturnType<typeof vi.fn>).mockImplementation(
      mockIsNativePlatform,
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("정상 케이스", () => {
    it("유효한 JSON 문자열을 파싱하고 KiyoDataFile을 반환하며 모든 후속 처리를 수행한다", async () => {
      const result = await openImportedDataFile(
        validJsonString,
        "1234",
        "test.json",
      );

      expect(result).not.toBeNull();
      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          metadata: [],
        }),
      );
      expect(isKiyoFile(result!)).toBe(true);

      // replaceDatabaseData 호출 확인
      expect(mockReplaceDatabaseData).toHaveBeenCalledTimes(1);
      expect(mockReplaceDatabaseData).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          metadata: [],
        }),
      );

      // setSession 호출 확인 (fileName만 전달, cryptoKey/salt 없음)
      expect(mockSetSession).toHaveBeenCalledTimes(1);
      expect(mockSetSession).toHaveBeenCalledWith({
        fileName: "test.json",
      });
      const callArgs = mockSetSession.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("cryptoKey");
      expect(callArgs).not.toHaveProperty("salt");

      // saveFileDataToDB 호출 확인 (평문 데이터, salt 없음)
      expect(mockSaveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = mockSaveFileDataToDB.mock.calls[0];
      expect(fileName).toBe("test.json");
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          metadata: [],
        }),
      );
      expect(salt).toBeUndefined();

      // setAccounts 호출 확인
      expect(mockSetAccounts).toHaveBeenCalledTimes(1);
      expect(mockSetAccounts).toHaveBeenCalledWith([]);
    });

    it("데이터가 있는 accounts, templates, metadata도 정상 처리한다", async () => {
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
        metadata: [{ id: 1, version: "1.0.0", createdAt: Date.now() }],
      });
      const jsonString = JSON.stringify(fullData);

      const result = await openImportedDataFile(
        jsonString,
        "1234",
        "test.json",
      );

      expect(result).not.toBeNull();
      expect(result!.accounts).toHaveLength(1);
      expect(result!.templates).toHaveLength(1);
      expect(result!.metadata).toHaveLength(1);
      expect(mockReplaceDatabaseData).toHaveBeenCalledWith(
        expect.objectContaining({
          accounts: fullData.accounts,
          templates: fullData.templates,
          metadata: fullData.metadata,
        }),
      );
      expect(mockSetAccounts).toHaveBeenCalledWith(fullData.accounts);
    });

    it("fileName은 데이터 내부의 fileName을 사용한다 (setSession과 saveFileDataToDB에 전달)", async () => {
      await openImportedDataFile(validJsonString, "1234", "test.json");

      expect(mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "test.json" }),
      );
      const saveCall = mockSaveFileDataToDB.mock.calls[0];
      expect(saveCall[0]).toBe("test.json");
      expect(saveCall[1]).toEqual(
        expect.objectContaining({
          fileName: "test.json",
        }),
      );
      expect(saveCall[2]).toBeUndefined();
    });
  });

  describe("실패 케이스", () => {
    it("JSON 파싱 실패 시 null을 반환한다", async () => {
      const invalidJson = "{ invalid json }";
      const result = await openImportedDataFile(invalidJson, "1234", "test.json");

      expect(result).toBeNull();
      expect(mockReplaceDatabaseData).not.toHaveBeenCalled();
      expect(mockSetSession).not.toHaveBeenCalled();
      expect(mockSetAccounts).not.toHaveBeenCalled();
      expect(mockSaveFileDataToDB).not.toHaveBeenCalled();
    });

    it("잘못된 version일 때 null을 반환한다 (1이 아닌 숫자, 문자열, 0, 음수)", async () => {
      const invalidVersions = [
        { version: 2 as unknown as 1 },
        { version: "1" as unknown as 1 },
        { version: 0 as unknown as 1 },
        { version: -1 as unknown as 1 },
      ];

      for (const { version } of invalidVersions) {
        vi.clearAllMocks();
        const invalidVersionFile = createValidKiyoFile({ version });
        const jsonString = JSON.stringify(invalidVersionFile);

        const result = await openImportedDataFile(jsonString, "1234", "test.json");

        expect(result).toBeNull();
        expect(mockReplaceDatabaseData).not.toHaveBeenCalled();
        expect(mockSetSession).not.toHaveBeenCalled();
        expect(mockSetAccounts).not.toHaveBeenCalled();
        expect(mockSaveFileDataToDB).not.toHaveBeenCalled();
      }
    });

    it("필수 필드(accounts, templates, metadata)가 누락되거나 배열이 아닐 때 null을 반환한다", async () => {
      const invalidFields = [
        { field: "accounts", value: undefined },
        {
          field: "accounts",
          value: "not an array" as unknown as Account[],
        },
        { field: "templates", value: undefined },
        {
          field: "templates",
          value: "not an array" as unknown as Template[],
        },
        { field: "metadata", value: undefined },
        {
          field: "metadata",
          value: "not an array" as unknown as Metadata[],
        },
      ];

      for (const { field, value } of invalidFields) {
        vi.clearAllMocks();
        const invalidFile = createValidKiyoFile({
          [field]: value,
        } as Partial<KiyoDataFile>);
        const jsonString = JSON.stringify(invalidFile);

        const result = await openImportedDataFile(jsonString, "1234", "test.json");

        expect(result).toBeNull();
      }
    });

    it("잘못된 타입의 입력(null, undefined, 숫자, 배열, 빈 문자열) 시 null을 반환한다", async () => {
      const invalidInputs = [
        { input: "" },
        { input: null },
        { input: undefined },
        { input: 123 },
        { input: [] },
      ];

      for (const { input } of invalidInputs) {
        vi.clearAllMocks();
        // @ts-expect-error - 의도적으로 잘못된 타입 전달
        const result = await openImportedDataFile(input, "1234");

        expect(result).toBeNull();
      }
    });

    it("replaceDatabaseData 실패 시 null을 반환하고 후속 처리를 하지 않는다", async () => {
      mockReplaceDatabaseData.mockRejectedValueOnce(new Error("DB error"));

      const result = await openImportedDataFile(validJsonString, "1234", "test.json");

      expect(result).toBeNull();
      expect(mockSetSession).not.toHaveBeenCalled();
      expect(mockSetAccounts).not.toHaveBeenCalled();
      expect(mockSaveFileDataToDB).not.toHaveBeenCalled();
    });

    it("saveFileDataToDB 실패 시 null을 반환한다", async () => {
      mockSaveFileDataToDB.mockRejectedValueOnce(new Error("DB save failed"));

      const result = await openImportedDataFile(validJsonString, "1234", "test.json");

      expect(result).toBeNull();
    });

    it("setSession 실패 시 null을 반환한다", async () => {
      mockSetSession.mockRejectedValueOnce(new Error("Session error"));

      const result = await openImportedDataFile(
        validJsonString,
        "1234",
        "test.json",
      );

      expect(result).toBeNull();
    });
  });

  describe("암호화 파일은 처리하지 않음 (isEncryptedKiyoFile이 true 반환 시)", () => {
    it("isEncryptedKiyoFile이 true를 반환하면 암호화 로직으로 분기한다 (평문 테스트에서는 mock이 false 반환)", async () => {
      // 이 테스트는 평문 파일만 테스트하므로 isEncryptedKiyoFile mock이 false를 반환함
      // 암호화 파일 테스트는 별도 테스트 파일에서 수행
      const result = await openImportedDataFile(
        validJsonString,
        "1234",
        "test.json",
      );

      expect(result).not.toBeNull();
      expect(mockIsEncryptedKiyoFile).toHaveBeenCalled();
    });
  });
});
