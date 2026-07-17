import "fake-indexeddb/auto";
import { vi } from "vitest";

// Mock TextEncoder and TextDecoder
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// Mock Capacitor plugins
vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn(() => ({
    isAutofillEnabled: vi.fn().mockResolvedValue({ enabled: false, hasService: false, servicePackageName: null }),
    getAutofillServiceInfo: vi.fn().mockResolvedValue({ isEnabled: false, isOurService: false, servicePackageName: null }),
    requestAutofillEnable: vi.fn().mockResolvedValue(undefined),
    getAccountCount: vi.fn().mockResolvedValue({ count: 0 }),
    syncAccountsFromReact: vi.fn().mockResolvedValue({ success: true, syncedCount: 0, errorCount: 0 }),
    syncAccounts: vi.fn().mockResolvedValue({ syncedCount: 0, errorCount: 0, totalProcessed: 0 }),
    getAccounts: vi.fn().mockResolvedValue({ accounts: [], count: 0 }),
    addAccount: vi.fn().mockResolvedValue({ id: 1, success: true }),
    updateAccount: vi.fn().mockResolvedValue({ updated: true, id: 1 }),
    deleteAccount: vi.fn().mockResolvedValue({ deleted: true, id: 1 }),
    toggleFavorite: vi.fn().mockResolvedValue({ success: true, id: 1 }),
    clearAllAccounts: vi.fn().mockResolvedValue({ deletedCount: 0, success: true }),
  })),
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
    isNativePlatform: vi.fn(() => false),
  },
}));

// Export mock for use in tests
export {};

// Mark completed tasks
// - [x] Analyze project structure and understand the codebase
// - [x] Review key components and architecture
// - [x] Identify improvements and missing features
// - [x] Prioritize recommendations by importance
