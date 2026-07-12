import { create } from "zustand";
import type { Account } from "../models/account";
import {
  db,
  createDataFile,
  initialAccounts,
  loadAccounts,
  restoreDataFile,
  syncDatabaseToFile,
} from "../database/db";
import type { KiyoDataFile } from "../database/fileStorage";

interface AccountState {
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  getAccountById: (id: number) => Account | undefined;
  resetToInitial: () => void;
  createFile: (fileName: string) => Promise<void>;
  restoreFile: (data: KiyoDataFile, fileName: string) => Promise<void>;
}

const accountsLoaded = loadAccounts();

export const useAccountStore = create<AccountState>()(
  (set, get) => ({
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
        void db.transaction("rw", db.accounts, async () => {
          await db.accounts.clear();
          await db.accounts.bulkAdd(initialAccounts);
          set({ accounts: initialAccounts });
          await syncDatabaseToFile();
        }).catch(console.error);
      },

      createFile: async (fileName) => {
        const accounts = await createDataFile(fileName);
        set({ accounts });
      },

      restoreFile: async (data, fileName) => {
        const accounts = await restoreDataFile(data, fileName);
        set({ accounts });
      },
  }),
);

void accountsLoaded
  .then((accounts) => useAccountStore.getState().setAccounts(accounts))
  .catch((error) => console.error("Failed to load accounts from Dexie:", error));
