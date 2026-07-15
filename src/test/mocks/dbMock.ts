import { vi, type Mock } from "vitest";
import type { KiyoDataFile } from "../../database/fileStorage";
import type { Account } from "../../models/account";

// ============================================
// Database Mock Types
// ============================================

export interface MockDB {
  mockSaveFileDataToDB: Mock;
  mockReplaceDatabaseData: Mock;
  mockGetDatabaseSnapshot: Mock;
  mockLoadAccountsFromDB: Mock;
  mockIsNativeFileStorageAvailable: Mock;
  mockClearFileData: Mock;
  mockGetAllFileNames: Mock;
  mockClearActiveFileInfo: Mock;
  mockGetActiveFileInfo: Mock;
  mockGetDatabase: Mock;
}

// ============================================
// Default Mock Values
// ============================================

const createMockKiyoDataFile = (): KiyoDataFile => ({
  version: 1,
  fileName: "test.json",
  updatedAt: Date.now(),
  accounts: [],
  templates: [],
  settings: [],
  metadata: [],
});

export const mockDBDefaults = {
  saveFileDataToDB: undefined,
  replaceDatabaseData: undefined,
  getDatabaseSnapshot: createMockKiyoDataFile(),
  loadAccountsFromDB: [] as Account[],
  isNativeFileStorageAvailable: false,
  clearFileData: undefined,
  getAllFileNames: [] as string[],
  clearActiveFileInfo: undefined,
  getActiveFileInfo: {
    activeFileName: null as string | null,
    salt: null as Uint8Array | null,
    encrypted: false,
    fileData: null as KiyoDataFile | null,
  },
  getDatabase: {} as any,
};

// ============================================
// Mock Factory Functions
// ============================================

/**
 * Creates mock functions for database module
 */
export const createDBMocks = () => {
  const mockSaveFileDataToDB = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.saveFileDataToDB);
  const mockReplaceDatabaseData = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.replaceDatabaseData);
  const mockGetDatabaseSnapshot = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.getDatabaseSnapshot);
  const mockLoadAccountsFromDB = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.loadAccountsFromDB);
  const mockIsNativeFileStorageAvailable = vi
    .fn()
    .mockReturnValue(mockDBDefaults.isNativeFileStorageAvailable);
  const mockClearFileData = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.clearFileData);
  const mockGetAllFileNames = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.getAllFileNames);
  const mockClearActiveFileInfo = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.clearActiveFileInfo);
  const mockGetActiveFileInfo = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.getActiveFileInfo);
  const mockGetDatabase = vi.fn().mockReturnValue(mockDBDefaults.getDatabase);

  return {
    mockSaveFileDataToDB,
    mockReplaceDatabaseData,
    mockGetDatabaseSnapshot,
    mockLoadAccountsFromDB,
    mockIsNativeFileStorageAvailable,
    mockClearFileData,
    mockGetAllFileNames,
    mockClearActiveFileInfo,
    mockGetActiveFileInfo,
    mockGetDatabase,
  };
};

/**
 * Creates a mock DB object with proper types
 */
export const createMockDB = (overrides?: Partial<MockDB>): MockDB => {
  const mocks = createDBMocks();

  return {
    mockSaveFileDataToDB: mocks.mockSaveFileDataToDB,
    mockReplaceDatabaseData: mocks.mockReplaceDatabaseData,
    mockGetDatabaseSnapshot: mocks.mockGetDatabaseSnapshot,
    mockLoadAccountsFromDB: mocks.mockLoadAccountsFromDB,
    mockIsNativeFileStorageAvailable: mocks.mockIsNativeFileStorageAvailable,
    mockClearFileData: mocks.mockClearFileData,
    mockGetAllFileNames: mocks.mockGetAllFileNames,
    mockClearActiveFileInfo: mocks.mockClearActiveFileInfo,
    mockGetActiveFileInfo: mocks.mockGetActiveFileInfo,
    mockGetDatabase: mocks.mockGetDatabase,
    ...overrides,
  };
};

// ============================================
// Default Export for Easy Import
// ============================================

export const dbMock = {
  createMocks: createDBMocks,
  createMockDB,
  defaults: mockDBDefaults,
};
