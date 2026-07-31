import { vi, type Mock } from "vitest";
import type { EncryptedKiyoFile } from "../../crypto/encryption";
import type { KiyoDataFile } from "../../database/fileStorage";

// ============================================
// Encryption Mock Types
// ============================================

export interface MockEncryption {
  mockCreateCryptoKey: Mock;
  mockEncryptData: Mock;
  mockDecryptData: Mock;
  mockIsEncryptedKiyoFile: Mock;
}

export interface MockEncryptionOverrides {
  mockCreateCryptoKey?: Mock;
  mockEncryptData?: Mock;
  mockDecryptData?: Mock;
  mockIsEncryptedKiyoFile?: Mock;
}

// ============================================
// Default Mock Values
// ============================================

const createMockCryptoKey = (): CryptoKey => ({}) as CryptoKey;
const createMockSalt = (): Uint8Array => new Uint8Array(16);

export const mockEncryptionDefaults = {
  createCryptoKey: {
    key: createMockCryptoKey(),
    salt: createMockSalt(),
  },
  encryptData: {
    version: 1,
    encrypted: true,
    salt: "bW9ja1NhbHQ=",
    iv: "bW9ja1ZlY3Rvcg==",
    ciphertext: "bW9ja0NpcGhlcnRleHQ=",
  } as EncryptedKiyoFile,
  decryptData: {
    version: 1,
    fileName: "test.json",
    updatedAt: Date.now(),
    accounts: [],
    templates: [],
    metadata: [],
  } as KiyoDataFile,
  isEncryptedKiyoFile: false,
};

// ============================================
// Mock Factory Functions
// ============================================

/**
 * Creates mock functions for encryption module
 */
export const createEncryptionMocks = () => {
  const mockCreateCryptoKey = vi.fn().mockImplementation(async () => {
    return mockEncryptionDefaults.createCryptoKey;
  });
  const mockEncryptData = vi.fn().mockImplementation(async () => {
    return mockEncryptionDefaults.encryptData;
  });
  const mockDecryptData = vi.fn().mockImplementation(async () => {
    return mockEncryptionDefaults.decryptData;
  });
  const mockIsEncryptedKiyoFile = vi
    .fn()
    .mockReturnValue(mockEncryptionDefaults.isEncryptedKiyoFile);

  return {
    mockCreateCryptoKey,
    mockEncryptData,
    mockDecryptData,
    mockIsEncryptedKiyoFile,
  };
};

/**
 * Creates a mock encryption object with proper types
 */
export const createMockEncryption = (
  overrides?: MockEncryptionOverrides,
): MockEncryption => {
  const mocks = createEncryptionMocks();

  return {
    mockCreateCryptoKey: overrides?.mockCreateCryptoKey ?? mocks.mockCreateCryptoKey,
    mockEncryptData: overrides?.mockEncryptData ?? mocks.mockEncryptData,
    mockDecryptData: overrides?.mockDecryptData ?? mocks.mockDecryptData,
    mockIsEncryptedKiyoFile: overrides?.mockIsEncryptedKiyoFile ?? mocks.mockIsEncryptedKiyoFile,
  };
};

// ============================================
// Default Export for Easy Import
// ============================================

export const encryptionMock = {
  createMocks: createEncryptionMocks,
  createMockEncryption,
  mockEncryptionDefaults,
};
