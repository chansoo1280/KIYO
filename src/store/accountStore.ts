import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Account } from "../models/account";
import { db, loadAccountsFromDB, syncDatabaseToFile } from "../database/db";
import { initialAccounts } from "../database/testdata";

interface AccountState {
  accounts: Account[];
  initialized: boolean;

  initialize: () => Promise<void>;
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  getAccountById: (id: number) => Account | undefined;
  resetToInitial: () => void;
}

export const useAccountStore = create<AccountState>()(
  devtools(
    (set, get) => ({
      accounts: [],
      initialized: false,
      initialize: async () => {
        const accounts = await loadAccountsFromDB();

        set({
          accounts,
          initialized: true,
        });
      },
      setAccounts: (accounts) => set({ accounts }),

      addAccount: async (account) => {
        const now = Date.now();
        const newAccount = await db.transaction("rw", db.accounts, async () => {
          const lastAccount = await db.accounts.orderBy("id").last();
          const id = (lastAccount?.id ?? 0) + 1;
          const createdAccount: Account = {
            ...account,
            id,
            createdAt: now,
            updatedAt: now,
            fields: account.fields.map((field, index) => ({
              ...field,
              id: `${id}-${index + 1}`,
              accountId: id,
            })),
          };
          await db.accounts.add(createdAccount);
          return createdAccount;
        });
        set((state) => ({ accounts: [newAccount, ...state.accounts] }));
        await syncDatabaseToFile();
        return newAccount;
      },

      updateAccount: async (account) => {
        const updatedAccount = { ...account, updatedAt: Date.now() };
        await db.accounts.put(updatedAccount);
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === updatedAccount.id ? updatedAccount : a,
          ),
        }));
        await syncDatabaseToFile();
      },

      deleteAccount: async (id) => {
        await db.accounts.delete(id);
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        }));
        await syncDatabaseToFile();
      },

      getAccountById: (id) => get().accounts.find((a) => a.id === id),

      resetToInitial: () => {
        void db
          .transaction("rw", db.accounts, async () => {
            await db.accounts.clear();
            await db.accounts.bulkAdd(initialAccounts);
            set({ accounts: initialAccounts });
            await syncDatabaseToFile();
          })
          .catch(console.error);
      },
    }),
    { name: "AccountStore" },
  ),
);
