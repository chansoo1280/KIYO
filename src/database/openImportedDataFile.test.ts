import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import { replaceDatabaseData } from "@/database/db";
import {
  openImportedDataFile,
  isKiyoFile,
  type KiyoDataFile,
} from "@/database/fileStorage";
import { FileStorageError, FileStorageErrorCode,  } from "@/errors/FileStorageError";
import type { Account, Metadata } from "@/models/account";
import type { Template } from "@/models/template";
import { createMockAccountStoreWithGetState } from "@/test/mocks/accountStoreMock";
import { createMockSessionStore } from "@/test/mocks/sessionStoreMock";

const fileTableMock = vi.hoisted(() => ({
  fileTable: {
    saveFileDataToDB: vi.fn(),
  },
}));
const dbMock = vi.hoisted(() => ({
  replaceDatabaseData: vi.fn(),
}));
// Mock fileTable using hoisted mock
vi.mock("@/database/fileTable", () => fileTableMock);
// Mock db functions
vi.mock("@/database/db", () => dbMock);
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
describe("openImportedDataFile", () => {
  let mockSessionStore: ReturnType<typeof createMockSessionStore>;
  let mockAccountStore: ReturnType<typeof createMockAccountStoreWithGetState>;

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
    mockSessionStore = createMockSessionStore();
    mockAccountStore = createMockAccountStoreWithGetState();

    // Configure mocks
    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
    vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("정상 케이스", () => {
    it("유효한 JSON 문자열을 파싱하고 KiyoDataFile을 반환하며 모든 후속 처리를 수행한다", async () => {
      const result = await openImportedDataFile(
        validJsonString,
        "1234",
        "test.json",
      );

      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          metadata: [],
        }),
      );
      expect(isKiyoFile(result)).toBe(true);

      // replaceDatabaseData 호출 확인
      expect(dbMock.replaceDatabaseData).toHaveBeenCalledTimes(1);
      expect(dbMock.replaceDatabaseData).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          fileName: "test.json",
          accounts: [],
          templates: [],
          metadata: [],
        }),
      );

      // setSession 호출 확인 (fileName만 전달, cryptoKey/salt 없음)
      expect(mockSessionStore.mockSetSession).toHaveBeenCalledTimes(1);
      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith({
        fileName: "test.json",
      });
      const callArgs = mockSessionStore.mockSetSession.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("cryptoKey");
      expect(callArgs).not.toHaveProperty("salt");

      // saveFileDataToDB 호출 확인 (평문 데이터, salt 없음)
      expect(fileTableMock.fileTable.saveFileDataToDB).toHaveBeenCalledTimes(1);
      const [fileName, data, salt] = fileTableMock.fileTable.saveFileDataToDB.mock.calls[0];
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
      expect(mockAccountStore.mockSetAccounts).toHaveBeenCalledTimes(1);
      expect(mockAccountStore.mockSetAccounts).toHaveBeenCalledWith([]);
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
        templates: [{ id: "1", name: "Template 1", description: "", icon: "📋", sortOrder: 0, fields: [], createdAt: Date.now(), updatedAt: Date.now() }],
        metadata: [{ id: 1, version: "1.0.0", createdAt: Date.now() }],
      });
      const jsonString = JSON.stringify(fullData);

      const result = await openImportedDataFile(
        jsonString,
        "",
        "test.json",
      );

      expect(result).toEqual(
        expect.objectContaining({
          accounts: fullData.accounts,
          templates: fullData.templates,
          metadata: fullData.metadata,
        }),
      );
      expect(result!.accounts).toHaveLength(1);
      expect(result!.templates).toHaveLength(1);
      expect(result!.metadata).toHaveLength(1);
      expect(dbMock.replaceDatabaseData).toHaveBeenCalledWith(
        expect.objectContaining({
          accounts: fullData.accounts,
          templates: fullData.templates,
          metadata: fullData.metadata,
        }),
      );
      expect(mockAccountStore.mockSetAccounts).toHaveBeenCalledWith(fullData.accounts);
    });

    it("fileName은 데이터 내부의 fileName을 사용한다 (setSession과 saveFileDataToDB에 전달)", async () => {
      await openImportedDataFile(validJsonString, "", "test.json");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "test.json" }),
      );
      const saveCall = fileTableMock.fileTable.saveFileDataToDB.mock.calls[0];
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
    it("JSON 파싱 실패 시 INVALID_JSON 에러를 던진다", async () => {
      const invalidJson = "{ invalid json }";
      await expect(
        openImportedDataFile(invalidJson, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(invalidJson, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.INVALID_JSON,
      });
      expect(dbMock.replaceDatabaseData).not.toHaveBeenCalled();
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
      expect(fileTableMock.fileTable.saveFileDataToDB).not.toHaveBeenCalled();
    });

    it("잘못된 version일 때 INVALID_FILE_FORMAT 에러를 던진다 (1이 아닌 숫자, 문자열, 0, 음수)", async () => {
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

        await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toThrow(FileStorageError);
        await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toMatchObject({
          code: FileStorageErrorCode.INVALID_FILE_FORMAT,
        });
        expect(dbMock.replaceDatabaseData).not.toHaveBeenCalled();
        expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
        expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
        expect(fileTableMock.fileTable.saveFileDataToDB).not.toHaveBeenCalled();
      }
    });

    it("필수 필드(accounts, templates, metadata)가 누락되거나 배열이 아닐 때 INVALID_FILE_FORMAT 에러를 던진다", async () => {
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

        await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toThrow(FileStorageError);
        await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toMatchObject({
          code: FileStorageErrorCode.INVALID_FILE_FORMAT,
        });
      }
    });

    it("잘못된 타입의 입력(null, undefined, 숫자, 배열, 빈 문자열) 시 에러를 던진다", async () => {
      const invalidInputs = [
        { input: "", expectErrorCode: FileStorageErrorCode.INVALID_JSON },
        { input: null, expectErrorCode: FileStorageErrorCode.INVALID_FILE_FORMAT },
        { input: undefined, expectErrorCode: FileStorageErrorCode.INVALID_JSON },
        { input: 123, expectErrorCode: FileStorageErrorCode.INVALID_FILE_FORMAT },
        { input: [], expectErrorCode: FileStorageErrorCode.INVALID_JSON }, // [].toString() = "" -> JSON.parse("") throws
      ];

      for (const { input, expectErrorCode } of invalidInputs) {
        vi.clearAllMocks();
        // Re-setup mocks after clearAllMocks
        vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
        vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore.mockStore);
        vi.mocked(replaceDatabaseData).mockImplementation(dbMock.replaceDatabaseData);
        vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

        // @ts-expect-error - 의도적으로 잘못된 타입 전달
        await expect(openImportedDataFile(input, "1234")).rejects.toThrow(FileStorageError);
        // @ts-expect-error - 의도적으로 잘못된 타입 전달
        await expect(openImportedDataFile(input, "1234")).rejects.toMatchObject({
          code: expectErrorCode,
        });
      }
    });
    it("replaceDatabaseData 실패 시 DATABASE_ERROR 에러를 던진다", async () => {
      dbMock.replaceDatabaseData.mockRejectedValueOnce(new Error("DB error"));

      await expect(
        openImportedDataFile(validJsonString, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(validJsonString, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.DATABASE_ERROR,
      });
      expect(mockSessionStore.mockSetSession).not.toHaveBeenCalled();
      expect(mockAccountStore.mockSetAccounts).not.toHaveBeenCalled();
      expect(fileTableMock.fileTable.saveFileDataToDB).not.toHaveBeenCalled();
    });

    it("saveFileDataToDB 실패 시 DATABASE_ERROR 에러를 던진다", async () => {
      fileTableMock.fileTable.saveFileDataToDB.mockRejectedValueOnce(new Error("DB save failed"));

      await expect(
        openImportedDataFile(validJsonString, "1234", "test.json"),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(validJsonString, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.DATABASE_ERROR,
      });
    });

    it("setSession 실패 시 DATABASE_ERROR 에러를 던진다", async () => {
      mockSessionStore.mockSetSession.mockRejectedValueOnce(new Error("Session error"));

      await expect(
        openImportedDataFile(
          validJsonString,
          "1234",
          "test.json",
        ),
      ).rejects.toThrow(FileStorageError);
      await expect(
        openImportedDataFile(validJsonString, "1234", "test.json"),
      ).rejects.toMatchObject({
        code: FileStorageErrorCode.DATABASE_ERROR,
      });
    });
  });

});