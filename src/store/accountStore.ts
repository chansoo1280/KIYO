import { create } from "zustand";
import type { Account } from "../models/account";
import {
  db,
  initialAccounts,
  loadAccountsFromDB,
  syncDatabaseToFile,
} from "../database/db";

interface AccountState {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  getAccountById: (id: number) => Account | undefined;
  resetToInitial: () => void;
}

const accountsLoaded = loadAccountsFromDB();

export const useAccountStore = create<AccountState>()((set, get) => ({
  accounts: [],

  setAccounts: (accounts) => set({ accounts }),

  addAccount: async (account) => {
    await accountsLoaded;
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
    await accountsLoaded;
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
    await accountsLoaded;
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
}));

void accountsLoaded
  .then((accounts) => useAccountStore.getState().setAccounts(accounts))
  .catch((error) =>
    console.error("Failed to load accounts from Dexie:", error),
  );
