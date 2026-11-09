import { describe, it, expect, vi } from "vitest";
import { normalizeDataFileName } from "@/database/fileExport";
import { isKiyoFile } from "@/database/fileStorage";
import { isEncryptedKiyoVaultData } from "@/crypto/encryption";
import {
  createTestKiyoDataFile,
  createTestEncryptedFile,
} from "@/test/fixtures/databaseFixtures";

// Mock Capacitor globally for these tests
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock("@/plugins/kiyofile", () => ({
  KiyoFile: {
    pickBackupFolder: vi.fn(),
    writeToUri: vi.fn(),
    readFromUri: vi.fn(),
  },
}));

import { Capacitor } from "@capacitor/core";
import { KiyoFile } from "@/plugins/kiyofile";
import { pickBackupFolder, writeBackupToUri } from "@/database/fileExport";

describe("fileStorage - pure functions", () => {
  describe("normalizeDataFileName", () => {
    describe("정상 입력", () => {
      it("파일명에 .json이 없으면 .json을 추가한다", () => {
        expect(normalizeDataFileName("my-data")).toBe("my-data.json");
      });

      it("파일명에 .json이 있으면 그대로 반환한다", () => {
        expect(normalizeDataFileName("my-data.json")).toBe("my-data.json");
      });

      it("앞뒤 공백을 제거하고 .json을 추가한다", () => {
        expect(normalizeDataFileName("  my-data  ")).toBe("my-data.json");
      });

      it("앞뒤 공백을 제거하고 .json이 있으면 그대로 반환한다", () => {
        expect(normalizeDataFileName("  my-data.json  ")).toBe("my-data.json");
      });

      it("대문자 .JSON도 소문자로 변환하지 않고 그대로 유지한다", () => {
        expect(normalizeDataFileName("my-data.JSON")).toBe("my-data.JSON.json");
      });

      it("기본 파일명 'kiyo-data'가 기본값으로 사용된다", () => {
        expect(normalizeDataFileName("")).toBe("kiyo-data.json");
      });

      it("공백만 있는 경우 기본 파일명 'kiyo-data.json'을 반환한다", () => {
        expect(normalizeDataFileName("   ")).toBe("kiyo-data.json");
      });

      it("탭과 개행문자도 공백으로 처리된다", () => {
        expect(normalizeDataFileName("\t\n  \t")).toBe("kiyo-data.json");
      });
    });

    describe("경계값", () => {
      it("매우 긴 파일명도 처리한다", () => {
        const longName = "a".repeat(255);
        expect(normalizeDataFileName(longName)).toBe(`${longName}.json`);
      });

      it(".json이 중간에 있어도 마지막에만 추가된다", () => {
        expect(normalizeDataFileName("my.json.data")).toBe("my.json.data.json");
      });

      it("여러 개의 .json이 있어도 마지막에만 추가된다", () => {
        expect(normalizeDataFileName("data.json.json")).toBe("data.json.json");
      });
    });

    describe("잘못된 입력", () => {
      it.each([
        { input: null, description: "null" },
        { input: undefined, description: "undefined" },
        { input: 123, description: "숫자" },
      ])("$description을 전달하면 TypeError를 던진다", ({ input }) => {
        // @ts-expect-error - 의도적으로 잘못된 타입 전달
        expect(() => normalizeDataFileName(input)).toThrow(TypeError);
      });
    });
  });

  describe("isKiyoFile", () => {
    const createValidKiyoFile = (
      overrides: Parameters<typeof createTestKiyoDataFile>[0] = {},
    ) => createTestKiyoDataFile(overrides);

    describe("정상 입력", () => {
      it("올바른 KiyoDataFile 객체는 true를 반환한다", () => {
        const validFile = createValidKiyoFile();
        expect(isKiyoFile(validFile)).toBe(true);
      });

      it("fileName이 필수 문자열이어야 한다", () => {
        const invalidFile = createValidKiyoFile({ fileName: undefined });
        expect(isKiyoFile(invalidFile)).toBe(false);
      });

      it("빈 배열들을 가진 객체도 true를 반환한다", () => {
        const validFile = createValidKiyoFile({
          accounts: [],
          templates: [],
          metadata: [],
        });
        expect(isKiyoFile(validFile)).toBe(true);
      });

      it("데이터가 있는 배열들을 가진 객체도 true를 반환한다", () => {
        const validFile = createValidKiyoFile({
          accounts: [
            {
              id: 1,
              templateId: "1",
              title: "Test",
              tags: [],
              favorite: false,
              fields: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
          templates: [{ id: "1", name: "Template", description: "", icon: "📋", sortOrder: 0, fields: [], createdAt: Date.now(), updatedAt: Date.now() }],
          metadata: [{ id: 1, version: "1.0", createdAt: Date.now() }],
        });
        expect(isKiyoFile(validFile)).toBe(true);
      });
    });

    describe("잘못된 입력 타입", () => {
      it.each([
        { input: null, description: "null" },
        { input: undefined, description: "undefined" },
        { input: "not an object", description: "문자열" },
        { input: 123, description: "숫자" },
        { input: [], description: "배열" },
        { input: {}, description: "빈 객체" },
      ])("$description은 false를 반환한다", ({ input }) => {
        expect(isKiyoFile(input)).toBe(false);
      });
    });

    describe("필수 필드 누락 및 타입 오류", () => {
      it.each([
        { field: "version", value: undefined, description: "version이 없으면" },
        { field: "version", value: 2, description: "version이 1이 아니면" },
        { field: "version", value: "1", description: "version이 문자열이면" },
        { field: "version", value: 0, description: "version이 0이면" },
        { field: "version", value: -1, description: "version이 음수면" },
        { field: "version", value: NaN, description: "version이 NaN이면" },
        {
          field: "accounts",
          value: undefined,
          description: "accounts가 없으면",
        },
        {
          field: "accounts",
          value: "not an array",
          description: "accounts가 배열이 아니면",
        },
        {
          field: "templates",
          value: undefined,
          description: "templates가 없으면",
        },
        {
          field: "templates",
          value: "not an array",
          description: "templates가 배열이 아니면",
        },
        {
          field: "metadata",
          value: undefined,
          description: "metadata가 없으면",
        },
        {
          field: "metadata",
          value: "not an array",
          description: "metadata가 배열이 아니면",
        },
        {
          field: "fileName",
          value: 123,
          description: "fileName이 문자열이 아니면",
        },
      ])("$description false를 반환한다", ({ field, value }) => {
        const invalidFile = createValidKiyoFile({
          [field]: value as never,
        });
        expect(isKiyoFile(invalidFile)).toBe(false);
      });
    });

    describe("updatedAt 타입 검증", () => {
      it("updatedAt이 숫자가 아니면 false를 반환한다", () => {
        const invalidFile = createValidKiyoFile({
          updatedAt: "not a number" as unknown as number,
        });
        expect(isKiyoFile(invalidFile)).toBe(false);
      });

      it("updatedAt이 0이면 true를 반환한다 (유효한 timestamp)", () => {
        const validFile = createValidKiyoFile({ updatedAt: 0 });
        expect(isKiyoFile(validFile)).toBe(true);
      });

      it("updatedAt이 음수여도 true를 반환한다 (타입 검증 안 함)", () => {
        const invalidFile = createValidKiyoFile({ updatedAt: -1 });
        expect(isKiyoFile(invalidFile)).toBe(true);
      });
    });
  });

  describe("isEncryptedKiyoVaultData", () => {
    const createValidEncryptedFile = (
      overrides: Parameters<typeof createTestEncryptedFile>[0] = {},
    ) => createTestEncryptedFile(overrides);

    describe("정상 입력", () => {
      it("올바른 EncryptedKiyoFile 객체는 true를 반환한다", () => {
        const validFile = createValidEncryptedFile();
        expect(isEncryptedKiyoVaultData(validFile)).toBe(true);
      });

      it("모든 필수 필드가 문자열이면 true를 반환한다", () => {
        const validFile = createValidEncryptedFile({
          salt: "salt",
          iv: "iv",
          ciphertext: "ciphertext",
        });
        expect(isEncryptedKiyoVaultData(validFile)).toBe(true);
      });

      it("빈 문자열도 문자열이므로 true를 반환한다", () => {
        const validFile = createValidEncryptedFile({
          salt: "",
          iv: "",
          ciphertext: "",
        });
        expect(isEncryptedKiyoVaultData(validFile)).toBe(true);
      });
    });

    describe("잘못된 입력 타입", () => {
      it.each([
        { input: null, description: "null" },
        { input: undefined, description: "undefined" },
        { input: "not an object", description: "문자열" },
        { input: 123, description: "숫자" },
        { input: [], description: "배열" },
        { input: {}, description: "빈 객체" },
        {
          input: {
            version: 1,
            fileName: "test.json",
            updatedAt: Date.now(),
            accounts: [],
            templates: [],
            metadata: [],
          },
          description: "KiyoDataFile 객체 (encrypted가 없음)",
        },
      ])("$description은 false를 반환한다", ({ input }) => {
        expect(isEncryptedKiyoVaultData(input)).toBe(false);
      });
    });

    describe("필수 필드 누락 및 타입 오류", () => {
      it.each([
        { field: "version", value: undefined, description: "version이 없으면" },
        { field: "version", value: 2, description: "version이 1이 아니면" },
        { field: "version", value: "1", description: "version이 문자열이면" },
        { field: "version", value: 0, description: "version이 0이면" },
        { field: "version", value: -1, description: "version이 음수면" },
        {
          field: "encrypted",
          value: undefined,
          description: "encrypted가 없으면",
        },
        {
          field: "encrypted",
          value: false,
          description: "encrypted가 true가 아니면",
        },
        {
          field: "encrypted",
          value: "true",
          description: "encrypted가 문자열이면",
        },
        { field: "salt", value: undefined, description: "salt가 없으면" },
        { field: "salt", value: 123, description: "salt가 문자열이 아니면" },
        { field: "salt", value: null, description: "salt가 null이면" },
        { field: "iv", value: undefined, description: "iv가 없으면" },
        { field: "iv", value: 123, description: "iv가 문자열이 아니면" },
        { field: "iv", value: undefined, description: "iv가 undefined면" },
        {
          field: "ciphertext",
          value: undefined,
          description: "ciphertext가 없으면",
        },
        {
          field: "ciphertext",
          value: 123,
          description: "ciphertext가 문자열이 아니면",
        },
      ])("$description false를 반환한다", ({ field, value }) => {
        const invalidFile = createValidEncryptedFile({
          [field]: value as never,
        });
        expect(isEncryptedKiyoVaultData(invalidFile)).toBe(false);
      });
    });

    describe("경계값", () => {
      it("빈 문자열 salt/iv/ciphertext도 유효한 문자열로 처리된다", () => {
        const validFile = createValidEncryptedFile({
          salt: "",
          iv: "",
          ciphertext: "",
        });
        expect(isEncryptedKiyoVaultData(validFile)).toBe(true);
      });
    });
  });
});

describe("fileExport - SAF auto-backup functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("pickBackupFolder", () => {
    it("네이티브가 아니면 success: false 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const result = await pickBackupFolder();
      expect(result).toEqual({ success: false });
    });

    it("native일 때 cancelled면 success: false 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(KiyoFile.pickBackupFolder).mockResolvedValue({
        success: false,
        cancelled: true,
      });

      const result = await pickBackupFolder();
      expect(result).toEqual({ success: false });
    });

    it("native일 때 성공하면 uri 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      const testUri = "content://com.android.externalstorage.documents/tree/test%3Abackup";
      vi.mocked(KiyoFile.pickBackupFolder).mockResolvedValue({
        success: true,
        uri: testUri,
        cancelled: false,
      });

      const result = await pickBackupFolder();
      expect(result).toEqual({ success: true, uri: testUri });
    });

    it("예외 발생 시 success: false 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(KiyoFile.pickBackupFolder).mockRejectedValue(new Error("Native error"));

      const result = await pickBackupFolder();
      expect(result).toEqual({ success: false });
    });
  });

  describe("writeBackupToUri", () => {
    const testData = { version: 1 as const, fileName: "test.json", updatedAt: Date.now(), accounts: [], templates: [], metadata: [] };

    it("네이티브가 아니면 에러 코드와 함께 false 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
      const result = await writeBackupToUri("test://uri", testData);
      expect(result).toEqual({
        success: false,
        errorCode: "WEB_UNSUPPORTED",
        errorMessage: "Persistent URI not available on web",
      });
    });

    it("native일 때 성공하면 success: true 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(KiyoFile.writeToUri).mockResolvedValue({
        success: true,
      });

      const result = await writeBackupToUri("content://test/uri", testData);
      expect(result).toEqual({ success: true });
    });

    it("native일 때 PERMISSION_REVOKED 에러 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(KiyoFile.writeToUri).mockResolvedValue({
        success: false,
        errorCode: "PERMISSION_REVOKED",
        errorMessage: "Permission revoked",
      });

      const result = await writeBackupToUri("content://test/uri", testData);
      expect(result).toEqual({
        success: false,
        errorCode: "PERMISSION_REVOKED",
        errorMessage: "Permission revoked",
      });
    });

    it("native일 때 WRITE_FAILED 에러 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(KiyoFile.writeToUri).mockResolvedValue({
        success: false,
        errorCode: "WRITE_FAILED",
        errorMessage: "Write failed",
      });

      const result = await writeBackupToUri("content://test/uri", testData);
      expect(result).toEqual({
        success: false,
        errorCode: "WRITE_FAILED",
        errorMessage: "Write failed",
      });
    });

    it("예외 발생 시 EXCEPTION 에러 코드 반환", async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      vi.mocked(KiyoFile.writeToUri).mockRejectedValue(new Error("Native exception"));

      const result = await writeBackupToUri("content://test/uri", testData);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("EXCEPTION");
      expect(result.errorMessage).toBe("Native exception");
    });
  });
});
