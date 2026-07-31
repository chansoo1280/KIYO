import { vi } from "vitest";
import "./common.setup";
const accountTableMock = vi.hoisted(() => ({
  accountTable: {
    getAll: vi.fn().mockResolvedValue([]),
    initializeDevData: vi.fn().mockResolvedValue(undefined),
    saveAll: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn().mockResolvedValue(undefined),
  },
}));

const templateTableMock = vi.hoisted(() => ({
  templateTable: {
    init: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([
      { id: "1", name: "로그인", sortOrder: 0, updatedAt: Date.now() },
      { id: "2", name: "API 키", sortOrder: 1, updatedAt: Date.now() },
      { id: "3", name: "신용/체크카드", sortOrder: 2, updatedAt: Date.now() },
      { id: "4", name: "은행 계좌", sortOrder: 3, updatedAt: Date.now() },
      { id: "5", name: "Wi-Fi", sortOrder: 4, updatedAt: Date.now() },
      { id: "6", name: "보안 메모", sortOrder: 5, updatedAt: Date.now() },
    ]),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    reorder: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock accountTable using hoisted mock
vi.mock("@/database/accountTable", () => accountTableMock);

// Mock templateTable using hoisted mock
vi.mock("@/database/templateTable", () => templateTableMock);
// Export mock for use in tests

export {};