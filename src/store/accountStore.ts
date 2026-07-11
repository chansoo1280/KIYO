import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Account } from "../models/account";
import { initialAccounts } from "../database/db";

interface AccountState {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Omit<Account, "id"> & { id?: string }) => Account;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  getAccountById: (id: string) => Account | undefined;
  resetToInitial: () => void;
}

// Helper function to get initial accounts (empty array for production, initialAccounts for development)
const getInitialAccounts = () => {
  // Check if we're in development mode
  if (import.meta.env.DEV) {
    return initialAccounts;
  }
  // In production, start with empty array (data will be loaded from localStorage if exists)
  return [];
};

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: getInitialAccounts(),

      setAccounts: (accounts) => set({ accounts }),

      addAccount: (account) => {
        // Generate new ID: find max existing ID and increment
        const maxId = get().accounts.reduce((max, acc) => {
          const idNum = parseInt(acc.id, 10);
          return !isNaN(idNum) && idNum > max ? idNum : max;
        }, 0);

        const newId = account.id || (maxId + 1).toString();

        // Create new account with generated ID
        const newAccount: Account = {
          ...account,
          id: newId,
          fields: account.fields.map((field, index) => ({
            ...field,
            id: `${newId}-${index + 1}`,
            accountId: newId,
          })),
        };

        set((state) => ({ accounts: [newAccount, ...state.accounts] }));

        return newAccount;
      },

      updateAccount: (account) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === account.id ? account : a,
          ),
        })),

      deleteAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        })),

      getAccountById: (id) => get().accounts.find((a) => a.id === id),

      resetToInitial: () => set({ accounts: initialAccounts }),
    }),
    {
      name: "kiyo_accounts",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ accounts: state.accounts }),
    },
  ),
);
