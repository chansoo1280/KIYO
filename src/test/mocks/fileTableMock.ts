import { vi, type Mock } from "vitest";
import type { KiyoDataFile } from "../../database/fileStorage";
import type { EncryptedKiyoFile } from "../../crypto/encryption";

// ============================================
// File Table Mock Types
// ============================================

export interface MockFileTable {
  mockSaveFileDataToDB: Mock;
  mockGetActiveFileInfo: Mock;
  mockClearActiveFileInfo: Mock;
  mockSaveActiveFileInfo: Mock;
  mockGetAllFileNames: Mock;
}

// ============================================
// Default Mock Values
// ============================================

export const mockFileTableDefaults = {
  saveFileDataToDB: undefined,
  getActiveFileInfo: {
    activeFileName: null as string | null,
    salt: null as Uint8Array | null,
    encrypted: false,
    fileData: null as KiyoDataFile | EncryptedKiyoFile | null,
  },
  clearActiveFileInfo: undefined,
  saveActiveFileInfo: undefined,
  getAllFileNames: [] as string[],
};

// ============================================
// Mock Factory Functions (for creating fresh typed mocks in tests)
// ============================================

/**
 * Creates mock functions for fileTable
 */
export const createFileTableMocks = () => {
  const mockSaveFileDataToDB = vi
    .fn()
    .mockResolvedValue(mockFileTableDefaults.saveFileDataToDB);
  const mockGetActiveFileInfo = vi
    .fn()
    .mockResolvedValue(mockFileTableDefaults.getActiveFileInfo);
  const mockClearActiveFileInfo = vi
    .fn()
    .mockResolvedValue(mockFileTableDefaults.clearActiveFileInfo);
  const mockSaveActiveFileInfo = vi
    .fn()
    .mockResolvedValue(mockFileTableDefaults.saveActiveFileInfo);
  const mockGetAllFileNames = vi
    .fn()
    .mockResolvedValue(mockFileTableDefaults.getAllFileNames);

  return {
    mockSaveFileDataToDB,
    mockGetActiveFileInfo,
    mockClearActiveFileInfo,
    mockSaveActiveFileInfo,
    mockGetAllFileNames,
  };
};

/**
 * Creates a mock fileTable object with proper types
 */
export const createMockFileTable = (
  overrides?: Partial<MockFileTable>,
): MockFileTable => {
  const mocks = createFileTableMocks();

  return {
    mockSaveFileDataToDB: mocks.mockSaveFileDataToDB,
    mockGetActiveFileInfo: mocks.mockGetActiveFileInfo,
    mockClearActiveFileInfo: mocks.mockClearActiveFileInfo,
    mockSaveActiveFileInfo: mocks.mockSaveActiveFileInfo,
    mockGetAllFileNames: mocks.mockGetAllFileNames,
    ...overrides,
  };
};

/**
 * Creates a mock for fileTable module import
 * Usage: vi.mock("./fileTable", () => ({ fileTable: createMockFileTableModule() }))
 */
export const createMockFileTableModule = (
  overrides?: Partial<MockFileTable>,
) => {
  const mocks = createFileTableMocks();

  return {
    fileTable: {
      saveFileDataToDB: mocks.mockSaveFileDataToDB,
      getActiveFileInfo: mocks.mockGetActiveFileInfo,
      clearActiveFileInfo: mocks.mockClearActiveFileInfo,
      saveActiveFileInfo: mocks.mockSaveActiveFileInfo,
      getAllFileNames: mocks.mockGetAllFileNames,
      ...overrides,
    },
  };
};

// ============================================
// Default Export for Easy Import
// ============================================

export const fileTableMock = {
  createMocks: createFileTableMocks,
  createMockTable: createMockFileTable,
  createMockModule: createMockFileTableModule,
  defaults: mockFileTableDefaults,
};