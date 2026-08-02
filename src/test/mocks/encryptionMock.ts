import { vi, type Mock } from "vitest";
import type { EncryptedKiyoVaultData } from "../../crypto/encryption";
import type { KiyoVaultData } from "../../models/vault";

// ============================================
// Encryption Mock Types
// ============================================

export interface MockEncryption {
  mockCreateCryptoKey: Mock;
  mockEncryptData: Mock;
  mockDecryptData: Mock;
  mockIsEncryptedKiyoVaultData: Mock;
  mockExportCryptoKey: Mock;
}

export interface MockEncryptionOverrides {
  mockCreateCryptoKey?: Mock;
  mockEncryptData?: Mock;
  mockDecryptData?: Mock;
  mockIsEncryptedKiyoVaultData?: Mock;
  mockExportCryptoKey?: Mock;
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
  } as EncryptedKiyoVaultData,
  decryptData: {
    version: 1,
    fileName: "test.json",
    updatedAt: Date.now(),
    accounts: [],
    templates: [],
    metadata: [],
  } as KiyoVaultData,
  isEncryptedKiyoVaultData: false,
  exportCryptoKey: new Uint8Array(32), // mock exported key
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
  const mockIsEncryptedKiyoVaultData = vi
    .fn()
    .mockReturnValue(mockEncryptionDefaults.isEncryptedKiyoVaultData);
  const mockExportCryptoKey = vi.fn().mockImplementation(async () => {
    return mockEncryptionDefaults.exportCryptoKey;
  });

  return {
    mockCreateCryptoKey,
    mockEncryptData,
    mockDecryptData,
    mockIsEncryptedKiyoVaultData,
    mockExportCryptoKey,
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
    mockIsEncryptedKiyoVaultData: overrides?.mockIsEncryptedKiyoVaultData ?? mocks.mockIsEncryptedKiyoVaultData,
    mockExportCryptoKey: overrides?.mockExportCryptoKey ?? mocks.mockExportCryptoKey,
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
