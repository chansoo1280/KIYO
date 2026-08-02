import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Filesystem } from "@capacitor/filesystem";
import { openImportedDataFile, exportDataFile } from "@/database/fileStorage";
import { FileStorageError, FileStorageErrorCode, isFileStorageError } from "@/errors/FileStorageError";
import { createTestEncryptedFile } from "@/test/fixtures/databaseFixtures";
import type { KiyoVaultData } from "@/models/vault";
import type { Account, Metadata } from "@/models/account";
import type { Template } from "@/models/template";

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

    it("잘못된 파일 형식 → is not KiyoFile 반환 (INVALID_FORMAT 상황)", async () => {
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
});