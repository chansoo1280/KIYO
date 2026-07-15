// ============================================
// Database Mock Fixtures
// ============================================
// Consolidates mocks used across database test files:
// - backupDataFile.test.ts
// - createDataFile.test.ts
// - openImportedDataFile.test.ts
// - openImportedDataFile.encrypted.test.ts
// - encryption.test.ts
// - crypto.utils.test.ts
// - db.test.ts
// - fileStorage.test.ts
// - fileStorage.encryption.integration.test.ts
// - fileStorage.lifecycle.integration.test.ts
// - fileStorage.restore.integration.test.ts
// - backupDataFile.test.ts
// - createDataFile.test.ts

import { vi, type Mock } from "vitest";
import type { KiyoDataFile } from "../../database/fileStorage";
import type {
  Account,
  Template,
  Setting,
  Metadata,
} from "../../models/account";
import type { EncryptedKiyoFile } from "../../crypto/encryption";
import {
  createTestKiyoDataFile,
  createTestEncryptedFile,
} from "../fixtures/databaseFixtures";

// ============================================
// Mock Types
// ============================================

export interface MockEncryption {
  isEncryptedKiyoFile: Mock;
  createCryptoKey: Mock;
  encryptData: Mock;
  decryptData: Mock;
  fromBase64: Mock;
  toBase64: Mock;
}

export interface MockCryptoUtils {
  fromBase64: Mock;
  toBase64: Mock;
}

export interface MockDB {
  saveFileDataToDB: Mock;
  replaceDatabaseData: Mock;
  getDatabaseSnapshot: Mock;
  loadAccountsFromDB: Mock;
  isNativeFileStorageAvailable: Mock;
}

export interface MockCapacitor {
  isNativePlatform: Mock;
}

// ============================================
// Default Mock Values / Test Data
// ============================================

export const createMockCryptoKey = (): CryptoKey => ({}) as CryptoKey;
export const createMockSalt = (): Uint8Array => new Uint8Array(16);
export const createMockEncryptedFile = (): EncryptedKiyoFile =>
  createTestEncryptedFile();
export const createMockDecryptedData = (
  overrides?: Partial<KiyoDataFile>,
): KiyoDataFile => createTestKiyoDataFile(overrides);

// Default mock return values for encryption
export const mockEncryptionReturns = {
  createCryptoKey: {
    key: createMockCryptoKey(),
    salt: createMockSalt(),
  },
  encryptData: createMockEncryptedFile(),
  decryptData: createMockDecryptedData(),
  isEncryptedKiyoFile: false,
  fromBase64: new Uint8Array(16),
  toBase64: "dGVzdC1iYXNlNjQ=",
};

// Default mock return values for DB
export const mockDBReturns = {
  saveFileDataToDB: undefined,
  replaceDatabaseData: undefined,
  getDatabaseSnapshot: createMockDecryptedData(),
  loadAccountsFromDB: [] as Account[],
  isNativeFileStorageAvailable: false,
};

// Default mock return values for session store
export const mockSessionStoreReturns = {
  setSession: undefined,
  setCryptoKey: undefined,
  clearSession: undefined,
};

// Default mock return values for account store
export const mockAccountStoreReturns = {
  initialize: undefined,
  setAccounts: undefined,
  addAccount: undefined,
  updateAccount: undefined,
  deleteAccount: undefined,
  getAccountById: undefined,
  resetToInitial: undefined,
};

// ============================================
// Mock Factory Functions
// ============================================

/**
 * Creates a mock sessionStore object with proper types
 */
export const createMockSessionStore = (
  overrides?: Partial<SessionState>,
): SessionState => {
  return {
    activeFileName: "test.json",
    cryptoKey: null,
    salt: null,
    lastSyncError: null,
    lastSyncErrorTime: null,
    setSession: vi.fn().mockResolvedValue(mockSessionStoreReturns.setSession),
    setCryptoKey: vi
      .fn()
      .mockResolvedValue(mockSessionStoreReturns.setCryptoKey),
    clearSession: vi
      .fn()
      .mockResolvedValue(mockSessionStoreReturns.clearSession),
    setSyncError: vi.fn(),
    clearSyncError: vi.fn(),
    ...overrides,
  };
};

/**
 * Creates mock functions for accountStore
 */
export const createAccountStoreMocks = () => {
  const mockInitialize = vi
    .fn()
    .mockResolvedValue(mockAccountStoreReturns.initialize);
  const mockSetAccounts = vi
    .fn()
    .mockReturnValue(mockAccountStoreReturns.setAccounts);
  const mockAddAccount = vi
    .fn()
    .mockReturnValue(mockAccountStoreReturns.addAccount);
  const mockUpdateAccount = vi
    .fn()
    .mockReturnValue(mockAccountStoreReturns.updateAccount);
  const mockDeleteAccount = vi
    .fn()
    .mockReturnValue(mockAccountStoreReturns.deleteAccount);
  const mockGetAccountById = vi
    .fn()
    .mockReturnValue(mockAccountStoreReturns.getAccountById);
  const mockResetToInitial = vi
    .fn()
    .mockReturnValue(mockAccountStoreReturns.resetToInitial);

  return {
    mockInitialize,
    mockSetAccounts,
    mockAddAccount,
    mockUpdateAccount,
    mockDeleteAccount,
    mockGetAccountById,
    mockResetToInitial,
  };
};

/**
 * Creates a mock accountStore object with proper types
 */
export const createMockAccountStore = (
  overrides?: Partial<AccountState>,
): AccountState => {
  const mocks = createAccountStoreMocks();

  return {
    accounts: [],
    initialized: false,
    initialize: mocks.mockInitialize,
    setAccounts: mocks.mockSetAccounts,
    addAccount: mocks.mockAddAccount,
    updateAccount: mocks.mockUpdateAccount,
    deleteAccount: mocks.mockDeleteAccount,
    getAccountById: mocks.mockGetAccountById,
    resetToInitial: mocks.mockResetToInitial,
    ...overrides,
  };
};

/**
 * Creates mock functions for encryption module
 */
export const createEncryptionMocks = () => {
  const mockIsEncryptedKiyoFile = vi
    .fn()
    .mockReturnValue(mockEncryptionReturns.isEncryptedKiyoFile);
  const mockCreateCryptoKey = vi
    .fn()
    .mockResolvedValue(mockEncryptionReturns.createCryptoKey);
  const mockEncryptData = vi
    .fn()
    .mockResolvedValue(mockEncryptionReturns.encryptData);
  const mockDecryptData = vi
    .fn()
    .mockResolvedValue(mockEncryptionReturns.decryptData);
  const mockFromBase64 = vi
    .fn()
    .mockReturnValue(mockEncryptionReturns.fromBase64);
  const mockToBase64 = vi.fn().mockReturnValue(mockEncryptionReturns.toBase64);

  return {
    mockIsEncryptedKiyoFile,
    mockCreateCryptoKey,
    mockEncryptData,
    mockDecryptData,
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
    isEncryptedKiyoFile: mocks.mockIsEncryptedKiyoFile,
    createCryptoKey: mocks.mockCreateCryptoKey,
    encryptData: mocks.mockEncryptData,
    decryptData: mocks.mockDecryptData,
    fromBase64: mocks.mockFromBase64,
    toBase64: mocks.mockToBase64,
    ...overrides,
  };
};

/**
 * Creates mock functions for crypto.utils
 */
export const createCryptoUtilsMocks = () => {
  const mockFromBase64 = vi
    .fn()
    .mockReturnValue(mockEncryptionReturns.fromBase64);
  const mockToBase64 = vi.fn().mockReturnValue(mockEncryptionReturns.toBase64);

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
    fromBase64: mocks.mockFromBase64,
    toBase64: mocks.mockToBase64,
    ...overrides,
  };
};

/**
 * Creates mock functions for database module
 */
export const createDBMocks = () => {
  const mockSaveFileDataToDB = vi
    .fn()
    .mockResolvedValue(mockDBReturns.saveFileDataToDB);
  const mockReplaceDatabaseData = vi
    .fn()
    .mockResolvedValue(mockDBReturns.replaceDatabaseData);
  const mockGetDatabaseSnapshot = vi
    .fn()
    .mockResolvedValue(mockDBReturns.getDatabaseSnapshot);
  const mockLoadAccountsFromDB = vi
    .fn()
    .mockResolvedValue(mockDBReturns.loadAccountsFromDB);
  const mockIsNativeFileStorageAvailable = vi
    .fn()
    .mockReturnValue(mockDBReturns.isNativeFileStorageAvailable);

  return {
    mockSaveFileDataToDB,
    mockReplaceDatabaseData,
    mockGetDatabaseSnapshot,
    mockLoadAccountsFromDB,
    mockIsNativeFileStorageAvailable,
  };
};

/**
 * Creates a mock DB object with proper types
 */
export const createMockDB = (overrides?: Partial<MockDB>): MockDB => {
  const mocks = createDBMocks();

  return {
    saveFileDataToDB: mocks.mockSaveFileDataToDB,
    replaceDatabaseData: mocks.mockReplaceDatabaseData,
    getDatabaseSnapshot: mocks.mockGetDatabaseSnapshot,
    loadAccountsFromDB: mocks.mockLoadAccountsFromDB,
    isNativeFileStorageAvailable: mocks.mockIsNativeFileStorageAvailable,
    ...overrides,
  };
};

/**
 * Creates mock functions for Capacitor
 */
export const createCapacitorMocks = () => {
  const mockIsNativePlatform = vi.fn().mockReturnValue(false);

  return {
    mockIsNativePlatform,
  };
};

/**
 * Creates a mock Capacitor object with proper types
 */
export const createMockCapacitor = (
  overrides?: Partial<MockCapacitor>,
): MockCapacitor => {
  const mocks = createCapacitorMocks();

  return {
    isNativePlatform: mocks.mockIsNativePlatform,
    ...overrides,
  };
};

// ============================================
// Pre-configured Mock Instances (for quick use)
// ============================================

// Session Store mocks

export const mockSessionStore = createMockSessionStore();

// Account Store mocks
export const {
  mockInitialize,
  mockSetAccounts,
  mockAddAccount,
  mockUpdateAccount,
  mockDeleteAccount,
  mockGetAccountById,
  mockResetToInitial,
} = createAccountStoreMocks();

export const mockAccountStore = createMockAccountStore();

// Encryption mocks
export const {
  mockIsEncryptedKiyoFile,
  mockCreateCryptoKey,
  mockEncryptData,
  mockDecryptData,
  mockFromBase64,
  mockToBase64,
} = createEncryptionMocks();

export const mockEncryption = createMockEncryption();

// Crypto Utils mocks
export const {
  mockFromBase64: mockCryptoUtilsFromBase64,
  mockToBase64: mockCryptoUtilsToBase64,
} = createCryptoUtilsMocks();

export const mockCryptoUtils = createMockCryptoUtils();

// DB mocks
export const {
  mockSaveFileDataToDB,
  mockReplaceDatabaseData,
  mockGetDatabaseSnapshot,
  mockLoadAccountsFromDB,
  mockIsNativeFileStorageAvailable,
} = createDBMocks();

export const mockDB = createMockDB();

// Capacitor mocks
export const { mockIsNativePlatform } = createCapacitorMocks();

export const mockCapacitor = createMockCapacitor();

// ============================================
// Helper to reset all mocks
// ============================================

export const resetAllMocks = () => {
  // Account Store
  mockInitialize.mockClear();
  mockSetAccounts.mockClear();
  mockAddAccount.mockClear();
  mockUpdateAccount.mockClear();
  mockDeleteAccount.mockClear();
  mockGetAccountById.mockClear();
  mockResetToInitial.mockClear();

  // Encryption
  mockIsEncryptedKiyoFile.mockClear();
  mockCreateCryptoKey.mockClear();
  mockEncryptData.mockClear();
  mockDecryptData.mockClear();
  mockFromBase64.mockClear();
  mockToBase64.mockClear();

  // Crypto Utils
  mockCryptoUtilsFromBase64.mockClear();
  mockCryptoUtilsToBase64.mockClear();

  // DB
  mockSaveFileDataToDB.mockClear();
  mockReplaceDatabaseData.mockClear();
  mockGetDatabaseSnapshot.mockClear();
  mockLoadAccountsFromDB.mockClear();
  mockIsNativeFileStorageAvailable.mockClear();

  // Capacitor
  mockIsNativePlatform.mockClear();
};

// Alias for backward compatibility
export const clearAllMocks = resetAllMocks;

// ============================================
// Configure functions for specific test files
// ============================================

/**
 * Configures mocks for backupDataFile tests
 * Includes: sessionStore (setSession, setCryptoKey), encryption (createCryptoKey, encryptData, isEncryptedKiyoFile), db (getDatabaseSnapshot, saveFileDataToDB)
 */
export const configureBackupDataFileMocks = () => {
  const mockSessionStore = createMockSessionStore();
  const mockEncryption = createMockEncryption();
  const mockDB = createMockDB();

  // Configure sessionStore
  vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore);

  // Configure encryption
  vi.mocked(isEncryptedKiyoFile).mockImplementation(
    mockEncryption.isEncryptedKiyoFile,
  );
  vi.mocked(createCryptoKey).mockImplementation(mockEncryption.createCryptoKey);
  vi.mocked(encryptData).mockImplementation(mockEncryption.encryptData);

  // Configure db
  vi.mocked(saveFileDataToDB).mockImplementation(mockDB.saveFileDataToDB);
  vi.mocked(getDatabaseSnapshot).mockImplementation(mockDB.getDatabaseSnapshot);

  return {
    mockSessionStore,
    mockEncryption,
    mockDB,
  };
};

/**
 * Configures mocks for createDataFile tests
 * Includes: sessionStore (setSession, setCryptoKey), encryption (createCryptoKey, encryptData), db (saveFileDataToDB)
 */
export const configureCreateDataFileMocks = () => {
  const mockSessionStore = createMockSessionStore();
  const mockEncryption = createMockEncryption();
  const mockDB = createMockDB();

  vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore);

  vi.mocked(createCryptoKey).mockImplementation(mockEncryption.createCryptoKey);
  vi.mocked(encryptData).mockImplementation(mockEncryption.encryptData);

  vi.mocked(saveFileDataToDB).mockImplementation(mockDB.saveFileDataToDB);

  return {
    mockSessionStore,
    mockEncryption,
    mockDB,
  };
};

/**
 * Configures mocks for openImportedDataFile plain file tests
 */
export const configurePlainFileMocks = () => {
  const mockSessionStore = createMockSessionStore();
  const mockAccountStore = createMockAccountStore();
  const mockEncryption = createMockEncryption();
  const mockDB = createMockDB();

  vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore);
  vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore);

  vi.mocked(isEncryptedKiyoFile).mockImplementation(
    mockEncryption.isEncryptedKiyoFile,
  );

  vi.mocked(saveFileDataToDB).mockImplementation(mockDB.saveFileDataToDB);
  vi.mocked(replaceDatabaseData).mockImplementation(mockDB.replaceDatabaseData);

  return {
    mockSessionStore,
    mockAccountStore,
    mockEncryption,
    mockDB,
  };
};

/**
 * Configures mocks for openImportedDataFile encrypted file tests
 */
export const configureEncryptedFileMocks = () => {
  const mockSessionStore = createMockSessionStore();
  const mockAccountStore = createMockAccountStore();
  const mockEncryption = createMockEncryption();
  const mockCryptoUtils = createMockCryptoUtils();
  const mockDB = createMockDB();
  const mockCapacitor = createMockCapacitor();

  vi.mocked(useSessionStore.getState).mockReturnValue(mockSessionStore);
  vi.mocked(useAccountStore.getState).mockReturnValue(mockAccountStore);

  vi.mocked(isEncryptedKiyoFile).mockImplementation(
    mockEncryption.isEncryptedKiyoFile,
  );
  vi.mocked(createCryptoKey).mockImplementation(mockEncryption.createCryptoKey);
  vi.mocked(decryptData).mockImplementation(mockEncryption.decryptData);
  vi.mocked(encryptData).mockImplementation(mockEncryption.encryptData);
  vi.mocked(toBase64).mockImplementation(mockEncryption.toBase64);

  vi.mocked(fromBase64).mockImplementation(mockCryptoUtils.fromBase64);
  vi.mocked(toBase64).mockImplementation(mockCryptoUtils.toBase64);

  vi.mocked(saveFileDataToDB).mockImplementation(mockDB.saveFileDataToDB);
  vi.mocked(replaceDatabaseData).mockImplementation(mockDB.replaceDatabaseData);
  vi.mocked(getDatabaseSnapshot).mockImplementation(mockDB.getDatabaseSnapshot);
  vi.mocked(loadAccountsFromDB).mockImplementation(mockDB.loadAccountsFromDB);
  vi.mocked(isNativeFileStorageAvailable).mockImplementation(
    mockDB.isNativeFileStorageAvailable,
  );

  vi.mocked(Capacitor.isNativePlatform).mockImplementation(
    mockCapacitor.isNativePlatform,
  );

  return {
    mockSessionStore,
    mockAccountStore,
    mockEncryption,
    mockCryptoUtils,
    mockDB,
    mockCapacitor,
  };
};

// ============================================
// Test Data Constants
// ============================================

export const TEST_PIN = "1234";
export const TEST_FILE_NAME = "test.json";
export const TEST_EMPTY_PIN = "";

// ============================================
// Common Test Helpers
// ============================================

/**
 * Creates a valid JSON string for a plain KiyoDataFile
 */
export const createValidJsonString = (
  overrides?: Partial<KiyoDataFile>,
): string => JSON.stringify(createTestKiyoDataFile(overrides));

/**
 * Creates a valid JSON string for an encrypted KiyoFile
 */
export const createEncryptedJsonString = (
  overrides?: Partial<EncryptedKiyoFile>,
): string => JSON.stringify(createTestEncryptedFile(overrides));

// ============================================
// Import actual modules for vi.mocked() to work
// ============================================

import { useSessionStore, type SessionState } from "../../store/sessionStore";
import { useAccountStore, type AccountState } from "../../store/accountStore";
import {
  isEncryptedKiyoFile,
  createCryptoKey,
  encryptData,
  decryptData,
} from "../../crypto/encryption";
import { fromBase64, toBase64 } from "../../crypto/crypto.utils";
import {
  saveFileDataToDB,
  replaceDatabaseData,
  getDatabaseSnapshot,
  loadAccountsFromDB,
  isNativeFileStorageAvailable,
} from "../../database/db";
import { Capacitor } from "@capacitor/core";

// ============================================
// Export all types
// ============================================

export type {
  KiyoDataFile,
  Account,
  Template,
  Setting,
  Metadata,
  EncryptedKiyoFile,
};
