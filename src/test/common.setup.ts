import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
// Mock TextEncoder and TextDecoder
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

// Mock Capacitor plugins
vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn(() => ({
    isAutofillEnabled: vi.fn().mockResolvedValue({
      enabled: false,
      hasService: false,
      servicePackageName: null,
    }),
    getAutofillServiceInfo: vi.fn().mockResolvedValue({
      isEnabled: false,
      isOurService: false,
      servicePackageName: null,
    }),
    requestAutofillEnable: vi.fn().mockResolvedValue(undefined),
    getAccountCount: vi.fn().mockResolvedValue({ count: 0 }),
    syncAccountsFromReact: vi
      .fn()
      .mockResolvedValue({ success: true, syncedCount: 0, errorCount: 0 }),
    syncAccounts: vi
      .fn()
      .mockResolvedValue({ syncedCount: 0, errorCount: 0, totalProcessed: 0 }),
    getAccounts: vi.fn().mockResolvedValue({ accounts: [], count: 0 }),
    addAccount: vi.fn().mockResolvedValue({ id: 1, success: true }),
    updateAccount: vi.fn().mockResolvedValue({ updated: true, id: 1 }),
    deleteAccount: vi.fn().mockResolvedValue({ deleted: true, id: 1 }),
    toggleFavorite: vi.fn().mockResolvedValue({ success: true, id: 1 }),
    clearAllAccounts: vi
      .fn()
      .mockResolvedValue({ deletedCount: 0, success: true }),
  })),
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => "web"),
  },
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error("File not found")),
  },
  Directory: {
    Documents: "DOCUMENTS",
  },
  Encoding: {
    UTF8: "utf8",
  },
}));
// Mock KiyoAutofill plugin
vi.mock("@/plugins/kiyautofill", () => ({
  KiyoAutofill: {
    isAutofillEnabled: vi.fn().mockResolvedValue({
      enabled: false,
      hasService: false,
      servicePackageName: null,
      isOurService: false,
      isEnabled: false,
      hasEnabledServices: false,
      serviceClassName: null,
    }),
    getAutofillServiceInfo: vi.fn().mockResolvedValue({
      servicePackageName: null,
      isOurService: false,
      isEnabled: false,
      hasEnabledServices: false,
      serviceClassName: null,
    }),
    requestAutofillEnable: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue({
      pong: true,
      timestamp: Date.now(),
      message: "KiyoAutofill plugin is working",
    }),
    getAccountCount: vi.fn().mockResolvedValue({ count: 0 }),
    syncAccountsFromReact: vi
      .fn()
      .mockResolvedValue({ success: true, syncedCount: 0, errorCount: 0 }),
  },
}));

// Mock SecureKey plugin
vi.mock("@/plugins/kiyosecurekey", () => ({
  SecureKey: {
    storeKey: vi.fn().mockResolvedValue(undefined),
    unlockKeyWithBiometric: vi.fn().mockResolvedValue({ key: "mock-key" }),
    deleteKey: vi.fn().mockResolvedValue(undefined),
    hasKey: vi.fn().mockResolvedValue({ exists: false }),
    isBiometryAvailable: vi.fn().mockResolvedValue({ available: false, type: "none" }),
  },
}));

// Export mock for use in tests
export {};