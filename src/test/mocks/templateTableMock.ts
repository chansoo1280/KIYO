import { vi, type Mock } from "vitest";
import type { Template } from "../../models/template";

// ============================================
// Template Table Mock Types
// ============================================

export interface MockTemplateTable {
  mockInit: Mock;
  mockGetAll: Mock;
  mockGetById: Mock;
  mockCreate: Mock;
  mockUpdate: Mock;
  mockDelete: Mock;
  mockReorder: Mock;
}

// ============================================
// Default Mock Values
// ============================================

const createDefaultTemplates = (): Template[] => [
  { id: "1", name: "로그인", sortOrder: 0, updatedAt: Date.now(), icon: "🔐", fields: [], createdAt: Date.now() },
  { id: "2", name: "API 키", sortOrder: 1, updatedAt: Date.now(), icon: "🔑", fields: [], createdAt: Date.now() },
  { id: "3", name: "신용/체크카드", sortOrder: 2, updatedAt: Date.now(), icon: "💳", fields: [], createdAt: Date.now() },
  { id: "4", name: "은행 계좌", sortOrder: 3, updatedAt: Date.now(), icon: "🏦", fields: [], createdAt: Date.now() },
  { id: "5", name: "Wi-Fi", sortOrder: 4, updatedAt: Date.now(), icon: "📶", fields: [], createdAt: Date.now() },
  { id: "6", name: "보안 메모", sortOrder: 5, updatedAt: Date.now(), icon: "📝", fields: [], createdAt: Date.now() },
];

export const mockTemplateTableDefaults = {
  init: undefined,
  getAll: createDefaultTemplates(),
  getById: undefined as Template | undefined,
  create: {} as Template,
  update: undefined,
  delete: undefined,
  reorder: undefined,
};

// ============================================
// Mock Factory Functions
// ============================================

/**
 * Creates mock functions for templateTable
 */
export const createTemplateTableMocks = () => {
  const mockInit = vi.fn().mockResolvedValue(mockTemplateTableDefaults.init);
  const mockGetAll = vi.fn().mockResolvedValue(mockTemplateTableDefaults.getAll);
  const mockGetById = vi.fn().mockResolvedValue(mockTemplateTableDefaults.getById);
  const mockCreate = vi.fn().mockResolvedValue(mockTemplateTableDefaults.create);
  const mockUpdate = vi.fn().mockResolvedValue(mockTemplateTableDefaults.update);
  const mockDelete = vi.fn().mockResolvedValue(mockTemplateTableDefaults.delete);
  const mockReorder = vi.fn().mockResolvedValue(mockTemplateTableDefaults.reorder);

  return {
    mockInit,
    mockGetAll,
    mockGetById,
    mockCreate,
    mockUpdate,
    mockDelete,
    mockReorder,
  };
};

/**
 * Creates a mock templateTable object with proper types
 */
export const createMockTemplateTable = (
  overrides?: Partial<MockTemplateTable>,
): MockTemplateTable => {
  const mocks = createTemplateTableMocks();

  return {
    mockInit: mocks.mockInit,
    mockGetAll: mocks.mockGetAll,
    mockGetById: mocks.mockGetById,
    mockCreate: mocks.mockCreate,
    mockUpdate: mocks.mockUpdate,
    mockDelete: mocks.mockDelete,
    mockReorder: mocks.mockReorder,
    ...overrides,
  };
};

/**
 * Creates a mock for templateTable module import
 * Usage: vi.mock("./templateTable", () => ({ templateTable: createMockTemplateTableModule() }))
 */
export const createMockTemplateTableModule = (
  overrides?: Partial<MockTemplateTable>,
) => {
  const mocks = createTemplateTableMocks();

  return {
    templateTable: {
      init: mocks.mockInit,
      getAll: mocks.mockGetAll,
      getById: mocks.mockGetById,
      create: mocks.mockCreate,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      reorder: mocks.mockReorder,
      ...overrides,
    },
  };
};

// ============================================
// Default Export for Easy Import
// ============================================

export const templateTableMock = {
  createMocks: createTemplateTableMocks,
  createMockTable: createMockTemplateTable,
  createMockModule: createMockTemplateTableModule,
  defaults: mockTemplateTableDefaults,
};