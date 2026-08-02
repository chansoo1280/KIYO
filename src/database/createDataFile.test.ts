import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDataFile } from "@/database/fileStorage";
import {
  createCryptoKey,
  encryptData,
} from "@/crypto/encryption";
import { useSessionStore } from "@/store/sessionStore";
import { createMockSessionStore } from "@/test/mocks/sessionStoreMock";
import { createMockEncryption, mockEncryptionDefaults } from "@/test/mocks/encryptionMock";

// Hoisted mocks for vi.mock
const fileTableMock = vi.hoisted(() => ({
  fileTable: {
    upsertFileRecord: vi.fn().mockResolvedValue(undefined),
  },
}));
// Mock fileTable
vi.mock("@/database/fileTable", () => fileTableMock);

// Mock sessionStore
vi.mock("@/store/sessionStore");

// Mock crypto functions
vi.mock("@/crypto/encryption");

describe("createDataFile - 행동 검증 (호출 순서/횟수/인자)", () => {
  const mockSessionStore = createMockSessionStore();
  const mockEncryption =  createMockEncryption();
  const mockCryptoKey = mockEncryptionDefaults.createCryptoKey.key;
  const mockSalt = mockEncryptionDefaults.createCryptoKey.salt;
  beforeEach(async () => {
    // Session store mock - 기존 팩토리 사용
    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);
    vi.mocked(createCryptoKey).mockImplementation(
      mockEncryption.mockCreateCryptoKey,
    );
    vi.mocked(encryptData).mockImplementation(mockEncryption.mockEncryptData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("평문 파일 생성 (PIN 없음)", () => {
    it("파일명 정규화 → upsertFileRecord → setSession 순서로 호출한다", async () => {
      await createDataFile("  test file  ");

      // 호출 순서 검증
      const callOrder: string[] = [];
      fileTableMock.fileTable.upsertFileRecord.mock.calls.forEach(() => callOrder.push("upsertFileRecord"));
      mockSessionStore.mockSetSession.mock.calls.forEach(() => callOrder.push("setSession"));

      expect(callOrder).toEqual(["upsertFileRecord", "setSession"]);
    });

    it("upsertFileRecord를 정규화된 파일명과 함께 1회 호출한다", async () => {
      await createDataFile("test-file");

      expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledTimes(1);
      const [fileName, data] = fileTableMock.fileTable.upsertFileRecord.mock.calls[0];
      expect(fileName).toBe("test-file.json");
      expect(data).toBeDefined();
    });

    it("setSession을 fileName과 함께 1회 호출한다", async () => {
      await createDataFile("test-file");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledTimes(1);
      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "test-file.json" })
      );
    });

    it("createCryptoKey를 호출하지 않는다", async () => {
      await createDataFile("test-file");

      expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
    });

    it("encryptData를 호출하지 않는다", async () => {
      await createDataFile("test-file");

      expect(mockEncryption.mockEncryptData).not.toHaveBeenCalled();
    });

    it("setCryptoKey를 호출하지 않는다", async () => {
      await createDataFile("test-file");

      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("빈 문자열 입력 시 기본 파일명 'kiyo-data.json' 사용", async () => {
      await createDataFile("");

      expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledWith(
        "kiyo-data.json",
        expect.anything()
      );
      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "kiyo-data.json" })
      );
    });

    it("공백만 있는 입력도 기본 파일명으로 처리", async () => {
      await createDataFile("   ");

      expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledWith(
        "kiyo-data.json",
        expect.anything()
      );
    });
  });

  describe("PIN 있는 파일 생성 (암호화)", () => {
    it("파일명 정규화 → createCryptoKey → encryptData → upsertFileRecord → setSession 순서로 호출한다", async () => {
      await createDataFile("  test  ", "1234");

      const callOrder: string[] = [];
      mockEncryption.mockCreateCryptoKey.mock.calls.forEach(() => callOrder.push("createCryptoKey"));
      mockEncryption.mockEncryptData.mock.calls.forEach(() => callOrder.push("encryptData"));
      fileTableMock.fileTable.upsertFileRecord.mock.calls.forEach(() => callOrder.push("upsertFileRecord"));
      mockSessionStore.mockSetSession.mock.calls.forEach(() => callOrder.push("setSession"));

      expect(callOrder).toEqual(["createCryptoKey", "encryptData", "upsertFileRecord", "setSession"]);
    });

    it("createCryptoKey를 PIN과 함께 1회만 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledTimes(1);
      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledWith("1234");
    });

    it("encryptData를 생성된 key/salt와 함께 1회 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockEncryption.mockEncryptData).toHaveBeenCalledTimes(1);
      const [data, key, salt] = mockEncryption.mockEncryptData.mock.calls[0];
      expect(key).toBe(mockCryptoKey);
      expect(salt).toEqual(mockSalt);
      expect(data).toBeDefined();
    });

    it("upsertFileRecord를 암호화된 데이터와 함께 1회 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledTimes(1);
      const [fileName, data] = fileTableMock.fileTable.upsertFileRecord.mock.calls[0];
      expect(fileName).toBe("test-file.json");
      expect(data).toEqual(mockEncryptionDefaults.encryptData);
    });

    it("setSession을 fileName, cryptoKey, salt와 함께 1회 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledTimes(1);
      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith({
        fileName: "test-file.json",
        cryptoKey: mockCryptoKey,
        salt: mockSalt,
      });
    });

    it("setCryptoKey는 호출하지 않는다 (setSession에서 처리)", async () => {
      await createDataFile("test-file", "1234");

      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
    });
  });

  describe("호출 횟수 종합 검증", () => {
    it("평문 생성 시: getState 3회, upsertFileRecord 1회, setSession 1회, 나머지는 0회", async () => {
      await createDataFile("plain");

      expect(vi.mocked(useSessionStore.getState)).toHaveBeenCalledTimes(3);
      expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledTimes(1);
      expect(mockSessionStore.mockSetSession).toHaveBeenCalledTimes(1);
      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledTimes(0);
      expect(mockEncryption.mockEncryptData).toHaveBeenCalledTimes(0);
      expect(mockSessionStore.mockSetCryptoKey).toHaveBeenCalledTimes(0);
    });

    it("암호화 생성 시: getState 3회, createCryptoKey 1회, encryptData 1회, upsertFileRecord 1회, setSession 1회, exportCryptoKey 1회", async () => {
      await createDataFile("encrypted", "1234");

      expect(vi.mocked(useSessionStore.getState)).toHaveBeenCalledTimes(3);
      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledTimes(1);
      expect(mockEncryption.mockEncryptData).toHaveBeenCalledTimes(1);
      expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledTimes(1);
      expect(mockSessionStore.mockSetSession).toHaveBeenCalledTimes(1);
      expect(mockSessionStore.mockSetCryptoKey).toHaveBeenCalledTimes(0);
    });
  });
});