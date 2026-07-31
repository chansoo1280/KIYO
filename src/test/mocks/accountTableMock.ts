import { vi, type Mock } from "vitest";
import type { Account } from "../../models/account";

// ============================================
// Account Table Mock Types
// ============================================

export interface MockAccountTable {
  mockGetAll: Mock;
  mockGetById: Mock;
  mockCreate: Mock;
  mockUpdate: Mock;
  mockDelete: Mock;
  mockSaveAll: Mock;
  mockClear: Mock;
  mockInitializeDevData: Mock;
}

// ============================================
// Default Mock Values
// ============================================

export const mockAccountTableDefaults = {
  getAll: [] as Account[],
  getById: undefined as Account | undefined,
  create: {} as Account,
  update: undefined,
  delete: undefined,
  saveAll: undefined,
  clear: undefined,
  initializeDevData: undefined,
};

// ============================================
// Mock Factory Functions
// ============================================

/**
 * Creates mock functions for accountTable
 */
export const createAccountTableMocks = () => {
  const mockGetAll = vi.fn().mockResolvedValue(mockAccountTableDefaults.getAll);
  const mockGetById = vi.fn().mockResolvedValue(mockAccountTableDefaults.getById);
  const mockCreate = vi.fn().mockResolvedValue(mockAccountTableDefaults.create);
  const mockUpdate = vi.fn().mockResolvedValue(mockAccountTableDefaults.update);
  const mockDelete = vi.fn().mockResolvedValue(mockAccountTableDefaults.delete);
  const mockSaveAll = vi.fn().mockResolvedValue(mockAccountTableDefaults.saveAll);
  const mockClear = vi.fn().mockResolvedValue(mockAccountTableDefaults.clear);
  const mockInitializeDevData = vi
    .fn()
    .mockResolvedValue(mockAccountTableDefaults.initializeDevData);

  return {
    mockGetAll,
    mockGetById,
    mockCreate,
    mockUpdate,
    mockDelete,
    mockSaveAll,
    mockClear,
    mockInitializeDevData,
  };
};

/**
 * Creates a mock accountTable object with proper types
 */
export const createMockAccountTable = (
  overrides?: Partial<MockAccountTable>,
): MockAccountTable => {
  const mocks = createAccountTableMocks();

  return {
    mockGetAll: mocks.mockGetAll,
    mockGetById: mocks.mockGetById,
    mockCreate: mocks.mockCreate,
    mockUpdate: mocks.mockUpdate,
    mockDelete: mocks.mockDelete,
    mockSaveAll: mocks.mockSaveAll,
    mockClear: mocks.mockClear,
    mockInitializeDevData: mocks.mockInitializeDevData,
    ...overrides,
  };
};

/**
 * Creates a mock for accountTable module import
 * Usage: vi.mock("./accountTable", () => ({ accountTable: createMockAccountTableModule() }))
 */
export const createMockAccountTableModule = (
  overrides?: Partial<MockAccountTable>,
) => {
  const mocks = createAccountTableMocks();

  return {
    accountTable: {
      getAll: mocks.mockGetAll,
      getById: mocks.mockGetById,
      create: mocks.mockCreate,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      saveAll: mocks.mockSaveAll,
      clear: mocks.mockClear,
      initializeDevData: mocks.mockInitializeDevData,
      ...overrides,
    },
  };
};

// ============================================
// Default Export for Easy Import
// ============================================

export const accountTableMock = {
  createMocks: createAccountTableMocks,
  createMockTable: createMockAccountTable,
  createMockModule: createMockAccountTableModule,
  defaults: mockAccountTableDefaults,
};