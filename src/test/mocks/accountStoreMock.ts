import { vi, type Mock } from "vitest";
import type { AccountState } from "../../store/accountStore";
import type { Account } from "../../models/account";

// ============================================
// Account Store Mock Types
// ============================================

export interface MockAccountStore {
  mockInitialize: Mock;
  mockSetAccounts: Mock;
  mockAddAccount: Mock;
  mockUpdateAccount: Mock;
  mockDeleteAccount: Mock;
  mockGetAccountById: Mock;
  mockClearAccounts: Mock;
  mockSyncToAutofill: Mock;
  mockAccountStore: AccountState;
}

// ============================================
// Default Mock Values
// ============================================

export const mockAccountStoreDefaults = {
  accounts: [] as Account[],
  initialized: false,
};

// ============================================
// Mock Factory Functions
// ============================================

/**
 * Creates mock functions for accountStore
 */
export const createAccountStoreMocks = () => {
  const mockInitialize = vi.fn().mockResolvedValue(undefined);
  const mockSetAccounts = vi.fn().mockReturnValue(undefined);
  const mockAddAccount = vi.fn().mockResolvedValue(undefined);
  const mockUpdateAccount = vi.fn().mockResolvedValue(undefined);
  const mockDeleteAccount = vi.fn().mockResolvedValue(undefined);
  const mockGetAccountById = vi.fn().mockReturnValue(undefined);
  const mockClearAccounts = vi.fn().mockResolvedValue(undefined);
  const mockSyncToAutofill = vi.fn().mockResolvedValue(undefined);

  return {
    mockInitialize,
    mockSetAccounts,
    mockAddAccount,
    mockUpdateAccount,
    mockDeleteAccount,
    mockGetAccountById,
    mockClearAccounts,
    mockSyncToAutofill,
  };
};

/**
 * Creates a mock AccountState object with proper types
 */
export const createMockAccountStore = (
  overrides?: Partial<AccountState>,
): AccountState => {
  const mocks = createAccountStoreMocks();

  return {
    accounts: [] as Account[],
    initialized: false,
    initialize: mocks.mockInitialize,
    setAccounts: mocks.mockSetAccounts,
    addAccount: mocks.mockAddAccount,
    updateAccount: mocks.mockUpdateAccount,
    deleteAccount: mocks.mockDeleteAccount,
    getAccountById: mocks.mockGetAccountById,
    clearAccounts: mocks.mockClearAccounts,
    syncToAutofill: mocks.mockSyncToAutofill,
    ...overrides,
  };
};

/**
 * Creates a complete mock account store with getState mock
 * Usage: vi.mocked(useAccountStore.getState).mockReturnValue(createMockAccountStoreWithGetState())
 */
export const createMockAccountStoreWithGetState = (
  overrides?: Partial<AccountState>,
) => {
  const mockStore = createMockAccountStore(overrides);
  const mockGetState = vi.fn(() => mockStore);

  return {
    mockStore,
    mockGetState,
    // Individual mock functions for direct access
    mockInitialize: mockStore.initialize,
    mockSetAccounts: mockStore.setAccounts,
    mockAddAccount: mockStore.addAccount,
    mockUpdateAccount: mockStore.updateAccount,
    mockDeleteAccount: mockStore.deleteAccount,
    mockGetAccountById: mockStore.getAccountById,
    mockClearAccounts: mockStore.clearAccounts,
  };
};

/**
 * Creates a mock for useAccountStore.getState()
 * Usage: vi.mocked(useAccountStore.getState).mockImplementation(createMockGetState())
 */
export const createMockGetState = (overrides?: Partial<AccountState>) => {
  const mockStore = createMockAccountStore(overrides);
  return vi.fn(() => mockStore);
};

/**
 * Creates a mock for useAccountStore.getState() that returns a specific store
 * Usage: vi.mocked(useAccountStore.getState).mockReturnValue(createMockAccountStoreForGetState())
 */
export const createMockAccountStoreForGetState = (
  overrides?: Partial<AccountState>,
) => {
  return createMockAccountStore(overrides);
};

// ============================================
// Default Export for Easy Import
// ============================================

export const accountStoreMock = {
  createMocks: createAccountStoreMocks,
  createMockStore: createMockAccountStore,
  createMockStoreWithGetState: createMockAccountStoreWithGetState,
  createMockGetState,
  createMockAccountStoreForGetState,
  defaults: mockAccountStoreDefaults,
};