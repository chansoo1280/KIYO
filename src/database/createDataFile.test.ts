import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDataFile } from "@/database/fileStorage";
import {
  createCryptoKey,
  encryptData,
} from "@/crypto/encryption";
// Import common mocks
import { createMockSessionStore } from "@/test/mocks/sessionStoreMock";
import {
  createMockEncryption,
  mockEncryptionDefaults,
} from "@/test/mocks/encryptionMock";
import { useSessionStore } from "@/store/sessionStore";
// Hoisted mocks for vi.mock
const fileTableMock = vi.hoisted(() => ({
  fileTable: {
    upsertFileRecord: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock sessionStore
vi.mock("@/store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(),
  },
}));

// Mock crypto functions
vi.mock("@/crypto/encryption", () => ({
  createCryptoKey: vi.fn(),
  encryptData: vi.fn(),
}));

// Mock crypto.utils
vi.mock("@/crypto/crypto.utils", () => ({
  exportCryptoKey: vi.fn(),
}));

// Mock fileTable
vi.mock("@/database/fileTable", () => fileTableMock);

describe("createDataFile", () => {
  let mockSessionStore: ReturnType<typeof createMockSessionStore>;
  let mockEncryption: ReturnType<typeof createMockEncryption>;

  const mockCryptoKey = {} as CryptoKey;
  const mockSalt = new Uint8Array(16);
  const mockEncryptedData = mockEncryptionDefaults.encryptData;

  beforeEach(async () => {
    // Create fresh mocks for each test
    mockSessionStore = createMockSessionStore();
    mockEncryption = createMockEncryption();

    // Configure mock implementations
    vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore.store);

    vi.mocked(createCryptoKey).mockImplementation(
      mockEncryption.mockCreateCryptoKey,
    );
    vi.mocked(encryptData).mockImplementation(mockEncryption.mockEncryptData);

    mockEncryption.mockCreateCryptoKey.mockResolvedValue({
      key: mockCryptoKey,
      salt: mockSalt,
    });
    mockEncryption.mockEncryptData.mockResolvedValue(mockEncryptedData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("평문 파일 생성 (PIN 없음)", () => {
    it("파일명 정규화를 적용한다 (공백 제거, .json 추가)", async () => {
      await createDataFile("  test file  ");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "test file.json" }),
      );
    });

    it("DB 저장 함수(upsertFileRecord)를 평문 데이터와 함께 호출한다", async () => {
      await createDataFile("test-file");

      expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledTimes(1);
      const [fileName, data] = fileTableMock.fileTable.upsertFileRecord.mock.calls[0];
      expect(fileName).toBe("test-file.json");
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test-file.json",
          accounts: [],
          templates: expect.arrayContaining([
            expect.objectContaining({ name: "로그인" }),
            expect.objectContaining({ name: "API 키" }),
            expect.objectContaining({ name: "신용/체크카드" }),
            expect.objectContaining({ name: "은행 계좌" }),
            expect.objectContaining({ name: "Wi-Fi" }),
            expect.objectContaining({ name: "보안 메모" }),
          ]),
          metadata: expect.arrayContaining([
            expect.objectContaining({ id: 1, version: "1.0.0" }),
          ]),
        }),
      );
    });

    it("sessionStore.setSession을 fileName과 함께 호출한다 (shouldSetActiveFile=true)", async () => {
      await createDataFile("test-file");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "test-file.json" }),
      );
    });

    it("cryptoKey와 salt를 저장하지 않는다 (평문 파일)", async () => {
      await createDataFile("test-file");

      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("createCryptoKey를 호출하지 않는다 (PIN 없음)", async () => {
      await createDataFile("test-file");

      expect(mockEncryption.mockCreateCryptoKey).not.toHaveBeenCalled();
    });

    it("encryptData를 호출하지 않는다 (PIN 없음)", async () => {
      await createDataFile("test-file");

      expect(mockEncryption.mockEncryptData).not.toHaveBeenCalled();
    });

    it("기본 파일명 'kiyo-data'를 사용한다 (빈 문자열 입력 시)", async () => {
      await createDataFile("");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "kiyo-data.json" }),
      );
    });

    it("공백만 있는 입력도 기본 파일명으로 처리한다", async () => {
      await createDataFile("   ");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith(
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

  describe("PIN 있는 파일 생성 (암호화)", () => {
    it("파일명 정규화를 적용한다", async () => {
      await createDataFile("  test  ", "1234");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "test.json" }),
      );
    });

    it("DB 저장 함수(upsertFileRecord)를 암호화 데이터와 함께 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledTimes(1);
      const [fileName, data] = fileTableMock.fileTable.upsertFileRecord.mock.calls[0];
      expect(fileName).toBe("test-file.json");
      expect(data).toEqual(mockEncryptedData);
    });

    it("createCryptoKey를 PIN과 함께 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledTimes(1);
      expect(mockEncryption.mockCreateCryptoKey).toHaveBeenCalledWith("1234");
    });

    it("AES 암호화 파일(EncryptedKiyoFile)을 생성한다", async () => {
      const result = await createDataFile("test-file", "1234");

      // 결과는 평문 데이터지만, 내부적으로 암호화된 파일이 저장됨
      expect(result).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test-file.json",
          accounts: expect.any(Array),
          templates: expect.any(Array),
          metadata: expect.any(Array),
        }),
      );
    });

    it("sessionStore.setSession을 fileName, cryptoKey, salt와 함께 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockSessionStore.mockSetSession).toHaveBeenCalledWith({
        fileName: "test-file.json",
        cryptoKey: mockCryptoKey,
        salt: mockSalt,
      });
    });

    it("setCryptoKey를 호출하지 않는다 (setSession에서 처리)", async () => {
      await createDataFile("test-file", "1234");

      expect(mockSessionStore.mockSetCryptoKey).not.toHaveBeenCalled();
    });

    it("encryptData를 생성된 cryptoKey와 salt로 호출한다", async () => {
      await createDataFile("test-file", "1234");

      expect(mockEncryption.mockEncryptData).toHaveBeenCalledTimes(1);
      const [data, key, salt] = mockEncryption.mockEncryptData.mock.calls[0];
      expect(key).toBe(mockCryptoKey);
      expect(salt).toEqual(mockSalt);
      expect(data).toEqual(
        expect.objectContaining({
          version: 1,
          fileName: "test-file.json",
          accounts: expect.any(Array),
          templates: expect.arrayContaining([
            expect.objectContaining({ name: "로그인" }),
            expect.objectContaining({ name: "API 키" }),
            expect.objectContaining({ name: "신용/체크카드" }),
            expect.objectContaining({ name: "은행 계좌" }),
            expect.objectContaining({ name: "Wi-Fi" }),
            expect.objectContaining({ name: "보안 메모" }),
          ]),
        }),
      );
    });
  });
});