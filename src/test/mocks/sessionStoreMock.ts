import { vi, type Mock } from "vitest";
import type { SessionState } from "../../store/sessionStore";

// ============================================
// Session Store Mock Types
// ============================================

export interface MockSessionStore {
  store: SessionState;
  mockSetSession: Mock;
  mockSetCryptoKey: Mock;
  mockClearSession: Mock;
  mockSetSyncError: Mock;
  mockClearSyncError: Mock;
  mockSetLastSyncTime: Mock;
}

// ============================================
// Default Mock Values
// ============================================

export const mockSessionStoreDefaults = {
  activeFileName: "test.json" as string | null,
  cryptoKey: null as CryptoKey | null,
  salt: null as Uint8Array | null,
  lastSyncError: null as string | null,
  lastSyncErrorTime: null as number | null,
  lastSyncTime: null as number | null,
};

// Type for CryptoKey (using global CryptoKey type)
type CryptoKey = globalThis.CryptoKey;

// ============================================
// Mock Factory Functions
// ============================================

/**
 * Creates mock functions for sessionStore
 */
export const createSessionStoreMocks = () => {
  const mockSetSession = vi.fn().mockResolvedValue(undefined);
  const mockSetCryptoKey = vi.fn().mockResolvedValue(undefined);
  const mockClearSession = vi.fn().mockResolvedValue(undefined);
  const mockSetSyncError = vi.fn();
  const mockClearSyncError = vi.fn();
  const mockSetLastSyncTime = vi.fn();

  return {
    mockSetSession,
    mockSetCryptoKey,
    mockClearSession,
    mockSetSyncError,
    mockClearSyncError,
    mockSetLastSyncTime,
  };
};

/**
 * Creates a mock SessionState object with proper types
 * Returns an object with store and individual mock functions for testing
 */
export const createMockSessionStore = (
  overrides?: Partial<SessionState>,
): MockSessionStore => {
  const mocks = createSessionStoreMocks();

  const store: SessionState = {
    activeFileName: mockSessionStoreDefaults.activeFileName,
    cryptoKey: mockSessionStoreDefaults.cryptoKey,
    salt: mockSessionStoreDefaults.salt,
    lastSyncError: mockSessionStoreDefaults.lastSyncError,
    lastSyncErrorTime: mockSessionStoreDefaults.lastSyncErrorTime,
    lastSyncTime: mockSessionStoreDefaults.lastSyncTime,
    setSession: mocks.mockSetSession,
    setCryptoKey: mocks.mockSetCryptoKey,
    clearSession: mocks.mockClearSession,
    setSyncError: mocks.mockSetSyncError,
    clearSyncError: mocks.mockClearSyncError,
    setLastSyncTime: mocks.mockSetLastSyncTime,
    ...(overrides ?? {}),
  };

  return {
    store,
    mockSetSession: mocks.mockSetSession,
    mockSetCryptoKey: mocks.mockSetCryptoKey,
    mockClearSession: mocks.mockClearSession,
    mockSetSyncError: mocks.mockSetSyncError,
    mockClearSyncError: mocks.mockClearSyncError,
    mockSetLastSyncTime: mocks.mockSetLastSyncTime,
  };
};

// ============================================
// Default Export for Easy Import
// ============================================

export const sessionStoreMock = {
  createMocks: createSessionStoreMocks,
  createMockStore: createMockSessionStore,
  defaults: mockSessionStoreDefaults,
};
