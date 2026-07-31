import { vi, type Mock } from "vitest";
import type { KiyoDataFile } from "../../database/fileStorage";

// ============================================
// Database Mock Types (for db.ts functions only)
// ============================================

export interface MockDB {
  // db.ts functions only
  mockReplaceDatabaseData: Mock;
  mockGetDatabaseSnapshot: Mock;
  mockInitializeDatabase: Mock;
  mockGetDatabase: Mock;
  mockIsNativeFileStorageAvailable: Mock;
  mockSyncDatabaseToFile: Mock;
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
  metadata: [],
});

export const mockDBDefaults = {
  // db.ts functions
  replaceDatabaseData: undefined,
  getDatabaseSnapshot: createMockKiyoDataFile(),
  initializeDatabase: undefined,
  getDatabase: {} as any,
  isNativeFileStorageAvailable: false,
  syncDatabaseToFile: undefined,
};

// ============================================
// Mock Factory Functions (for creating fresh typed mocks in tests)
// ============================================

/**
 * Creates mock functions for database module (db.ts)
 */
export const createDBMocks = () => {
  const mockReplaceDatabaseData = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.replaceDatabaseData);
  const mockGetDatabaseSnapshot = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.getDatabaseSnapshot);
  const mockInitializeDatabase = vi.fn().mockResolvedValue(undefined);
  const mockGetDatabase = vi.fn().mockReturnValue(mockDBDefaults.getDatabase);
  const mockIsNativeFileStorageAvailable = vi
    .fn()
    .mockReturnValue(mockDBDefaults.isNativeFileStorageAvailable);
  const mockSyncDatabaseToFile = vi
    .fn()
    .mockResolvedValue(mockDBDefaults.syncDatabaseToFile);

  return {
    mockReplaceDatabaseData,
    mockGetDatabaseSnapshot,
    mockInitializeDatabase,
    mockGetDatabase,
    mockIsNativeFileStorageAvailable,
    mockSyncDatabaseToFile,
  };
};

/**
 * Creates a mock DB object with proper types
 */
export const createMockDB = (overrides?: Partial<MockDB>): MockDB => {
  const mocks = createDBMocks();

  return {
    mockReplaceDatabaseData: mocks.mockReplaceDatabaseData,
    mockGetDatabaseSnapshot: mocks.mockGetDatabaseSnapshot,
    mockInitializeDatabase: mocks.mockInitializeDatabase,
    mockGetDatabase: mocks.mockGetDatabase,
    mockIsNativeFileStorageAvailable: mocks.mockIsNativeFileStorageAvailable,
    mockSyncDatabaseToFile: mocks.mockSyncDatabaseToFile,
    ...overrides,
  };
};

/**
 * Creates a mock for db module import
 * Usage: vi.mock("./db", () => ({ ...createMockDBModule(), ... }))
 */
export const createMockDBModule = (overrides?: Partial<MockDB>) => {
  const mocks = createDBMocks();

  return {
    replaceDatabaseData: mocks.mockReplaceDatabaseData,
    getDatabaseSnapshot: mocks.mockGetDatabaseSnapshot,
    initializeDatabase: mocks.mockInitializeDatabase,
    getDatabase: mocks.mockGetDatabase,
    isNativeFileStorageAvailable: mocks.mockIsNativeFileStorageAvailable,
    syncDatabaseToFile: mocks.mockSyncDatabaseToFile,
    ...overrides,
  };
};

// ============================================
// Default Export for Easy Import
// ============================================

export const dbMock = {
  createMocks: createDBMocks,
  createMockDB,
  createMockModule: createMockDBModule,
  defaults: mockDBDefaults,
};