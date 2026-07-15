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
  mockFromBase64: Mock;
  mockToBase64: Mock;
}

export interface MockCryptoUtils {
  mockFromBase64: Mock;
  mockToBase64: Mock;
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
    settings: [],
    metadata: [],
  } as KiyoDataFile,
  isEncryptedKiyoFile: false,
  fromBase64: createMockSalt(),
  toBase64: "bW9ja0Jhc2U2NA==",
};

// ============================================
// Mock Factory Functions
// ============================================

/**
 * Creates mock functions for encryption module
 */
export const createEncryptionMocks = () => {
  const mockCreateCryptoKey = vi
    .fn()
    .mockResolvedValue(mockEncryptionDefaults.createCryptoKey);
  const mockEncryptData = vi
    .fn()
    .mockResolvedValue(mockEncryptionDefaults.encryptData);
  const mockDecryptData = vi
    .fn()
    .mockResolvedValue(mockEncryptionDefaults.decryptData);
  const mockIsEncryptedKiyoFile = vi
    .fn()
    .mockReturnValue(mockEncryptionDefaults.isEncryptedKiyoFile);
  const mockFromBase64 = vi
    .fn()
    .mockReturnValue(mockEncryptionDefaults.fromBase64);
  const mockToBase64 = vi.fn().mockReturnValue(mockEncryptionDefaults.toBase64);

  return {
    mockCreateCryptoKey,
    mockEncryptData,
    mockDecryptData,
    mockIsEncryptedKiyoFile,
    mockFromBase64,
    mockToBase64,
  };
};

/**
 * Creates a mock encryption object with proper types
 */
export const createMockEncryption = (
  overrides?: Partial<MockEncryption>,
): MockEncryption => {
  const mocks = createEncryptionMocks();

  return {
    mockCreateCryptoKey: mocks.mockCreateCryptoKey,
    mockEncryptData: mocks.mockEncryptData,
    mockDecryptData: mocks.mockDecryptData,
    mockIsEncryptedKiyoFile: mocks.mockIsEncryptedKiyoFile,
    mockFromBase64: mocks.mockFromBase64,
    mockToBase64: mocks.mockToBase64,
    ...overrides,
  };
};

/**
 * Creates mock functions for crypto.utils module
 */
export const createCryptoUtilsMocks = () => {
  const mockFromBase64 = vi
    .fn()
    .mockReturnValue(mockEncryptionDefaults.fromBase64);
  const mockToBase64 = vi.fn().mockReturnValue(mockEncryptionDefaults.toBase64);

  return {
    mockFromBase64,
    mockToBase64,
  };
};

/**
 * Creates a mock crypto.utils object with proper types
 */
export const createMockCryptoUtils = (
  overrides?: Partial<MockCryptoUtils>,
): MockCryptoUtils => {
  const mocks = createCryptoUtilsMocks();

  return {
    mockFromBase64: mocks.mockFromBase64,
    mockToBase64: mocks.mockToBase64,
    ...overrides,
  };
};

// ============================================
// Default Export for Easy Import
// ============================================

export const encryptionMock = {
  createMocks: createEncryptionMocks,
  createMockEncryption,
  createCryptoUtilsMocks,
  createMockCryptoUtils,
  defaults: mockEncryptionDefaults,
};
