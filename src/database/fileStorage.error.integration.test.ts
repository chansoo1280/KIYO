import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Filesystem } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { KiyoFile } from "@/plugins/kiyofile";
import { openImportedDataFile, exportDataFile } from "@/database/fileStorage";
import { exportBackupFile } from "@/database/fileExport";
import { FileStorageError, FileStorageErrorCode, isFileStorageError } from "@/errors/FileStorageError";
import { createTestEncryptedFile } from "@/test/fixtures/databaseFixtures";
import type { KiyoVaultData } from "@/models/vault";
import type { Account, Metadata } from "@/models/account";
import type { Template } from "@/models/template";

// Mock KiyoFile plugin for SAF tests
vi.mock("@/plugins/kiyofile", () => ({
  KiyoFile: {
    saveFile: vi.fn(),
    openFile: vi.fn(),
    writeToUri: vi.fn(),
    readFromUri: vi.fn(),
  },
}));

describe("fileStorage - error handling", () => {

  const createValidKiyoFile = (overrides: Partial<KiyoVaultData> = {}): KiyoVaultData => ({
    version: 1, fileName: "test.json", updatedAt: Date.now(),
    accounts: [] as Account[], templates: [] as Template[],
    metadata: [] as Metadata[],
    ...overrides,
  });

  const encryptedJsonString = JSON.stringify(createTestEncryptedFile());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => vi.resetAllMocks());

  describe("openImportedDataFile", () => {
    it("잘못된 JSON → JSON 파싱 실패 반환 (INVALID_JSON 상황)", async () => {
      await expect(openImportedDataFile("{ invalid json }", "1234", "test.json")).rejects.toThrow("JSON 파싱 실패")
    });

    it("잘못된 PIN → PIN 불일치 반환 (INVALID_PIN 상황)", async () => {
      await expect(openImportedDataFile(encryptedJsonString, "wrong-pin", "test.json")).rejects.toThrow("PIN 불일치")
    });

    it("잘못된 파일 형식 → is not KiyoFile 반환 (INVALID_FILE_FORMAT 상황)", async () => {
      await expect(openImportedDataFile(JSON.stringify(createValidKiyoFile({ version: 2 as unknown as 1 })), "1234", "test.json")).rejects.toThrow("is not KiyoFile");
    });
  });

  describe("exportDataFile", () => {
    it("파일 저장 실패 → WRITE_FAILED 에러를 던진다", async () => {
      vi.mocked(Filesystem.writeFile).mockRejectedValueOnce(new Error("Write failed"));
      try { await exportDataFile(createValidKiyoFile(), "test.json"); }
      catch (error: unknown) { expect(isFileStorageError(error)).toBe(true); expect((error as FileStorageError).code).toBe(FileStorageErrorCode.WRITE_FAILED); }
    });
  });

  describe("openImportedDataFile - 암호화 파일 에러 분기", () => {
    it("잘못된 salt (길이 불일치: 8바이트) → INVALID_SALT 에러", async () => {
      // 8 bytes base64 encoded = 12 chars (e.g., "AAAAAAAAAAA=")
      const file = createTestEncryptedFile({ salt: "AAAAAAAAAAA=" });
      const jsonString = JSON.stringify(file);
      await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toMatchObject({
        code: FileStorageErrorCode.INVALID_SALT,
      });
    });

    it("누락된 salt → INVALID_FILE_FORMAT 에러 (isEncryptedKiyoVaultData에서 걸러짐)", async () => {
      const file = createTestEncryptedFile({ salt: undefined });
      const jsonString = JSON.stringify(file);
      await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toMatchObject({
        code: FileStorageErrorCode.INVALID_FILE_FORMAT,
      });
    });

    it("null salt → INVALID_FILE_FORMAT 에러 (isEncryptedKiyoVaultData에서 걸러짐)", async () => {
      // Partial 타입을 이용해 null 전달 (런타임에서 걸러짐)
      const file = createTestEncryptedFile({ salt: null as unknown as string | undefined });
      const jsonString = JSON.stringify(file);
      await expect(openImportedDataFile(jsonString, "1234", "test.json")).rejects.toMatchObject({
        code: FileStorageErrorCode.INVALID_FILE_FORMAT,
      });
    });
  });

  describe("exportBackupFile - SAF picker cancellation", () => {
    const createValidKiyoFile = (overrides: Partial<KiyoVaultData> = {}): KiyoVaultData => ({
      version: 1,
      fileName: "test.json",
      updatedAt: Date.now(),
      accounts: [] as Account[],
      templates: [] as Template[],
      metadata: [] as Metadata[],
      ...overrides,
    });

    const validFile = createValidKiyoFile();
    const fileName = "test-backup.json";

    beforeEach(() => {
      vi.clearAllMocks();
      // SAF 경로 강제 (Android 네이티브 환경으로 설정)
      vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it("사용자가 SAF picker에서 취소 → 'User cancelled backup' 에러", async () => {
      // Arrange: KiyoFile.saveFile mock → cancelled: true
      vi.mocked(KiyoFile.saveFile).mockResolvedValueOnce({
        success: false,
        cancelled: true,
        uri: "",
      });

      // Act & Assert
      await expect(exportBackupFile(fileName, validFile)).rejects.toMatchObject({
        code: FileStorageErrorCode.WRITE_FAILED,
        message: "User cancelled backup",
      });

      // 호출 검증
      expect(KiyoFile.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining(".json"),
          mimeType: "application/json",
        })
      );
    });

    it("SAF picker 실패 (cancelled: false) → 'Failed to save backup file' 에러", async () => {
      vi.mocked(KiyoFile.saveFile).mockResolvedValueOnce({
        success: false,
        cancelled: false,
        uri: "",
      });

      await expect(exportBackupFile(fileName, validFile)).rejects.toMatchObject({
        code: FileStorageErrorCode.WRITE_FAILED,
        message: "Failed to save backup file",
      });
    });
  });
});