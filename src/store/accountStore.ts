import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Account } from "../models/account";
import {
  db,
  loadAccountsFromDB,
  syncDatabaseToFile,
  saveAccountsToDB,
  clearAccounts,
} from "../database/db";
import { Capacitor } from "@capacitor/core";
import { KiyoAutofill } from "../plugins/kiyautofill";
import { useSessionStore } from "./sessionStore";

export interface AccountState {
  accounts: Account[];
  initialized: boolean;

  initialize: () => Promise<void>;
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  getAccountById: (id: number) => Account | undefined;
  clearAccounts: () => void;
  syncToAutofill: () => Promise<void>;
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

        // Sync to Android Autofill after initialization
        await get().syncToAutofill();
      },
      setAccounts: async (accounts) => {
        set({ accounts });
        await syncDatabaseToFile();
        await get().syncToAutofill();
      },

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

        // Save with encryption if crypto key is available
        const { cryptoKey } = useSessionStore.getState();
        await saveAccountsToDB(get().accounts, cryptoKey ?? undefined);
        await syncDatabaseToFile();
        await get().syncToAutofill();
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

        // Save with encryption if crypto key is available
        const { cryptoKey } = useSessionStore.getState();
        await saveAccountsToDB(get().accounts, cryptoKey ?? undefined);
        await syncDatabaseToFile();
        await get().syncToAutofill();
      },

      deleteAccount: async (id) => {
        await db.accounts.delete(id);
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        }));

        // Save with encryption if crypto key is available
        const { cryptoKey } = useSessionStore.getState();
        await saveAccountsToDB(get().accounts, cryptoKey ?? undefined);
        await syncDatabaseToFile();
        await get().syncToAutofill();
      },

      getAccountById: (id) => get().accounts.find((a) => a.id === id),

      clearAccounts: async () => {
        set({ accounts: [], initialized: false });
        await clearAccounts();
        await get().syncToAutofill();
      },

      syncToAutofill: async () => {
        // Only sync on Android platform
        if (Capacitor.getPlatform() !== "android") {
          return;
        }

        try {
          const accounts = get().accounts;
          const accountsJson = JSON.stringify(accounts);
          const result = await KiyoAutofill.syncAccountsFromReact({
            accountsJson,
          });

          if (result.success) {
            console.log(
              `[Autofill] Synced ${result.syncedCount} accounts, ${result.errorCount} errors`,
            );
          } else {
            console.warn(
              `[Autofill] Sync completed with errors: ${result.errorCount} errors`,
            );
          }
        } catch (error) {
          console.error("[Autofill] Failed to sync accounts:", error);
        }
      },
    }),
    { name: "AccountStore" },
  ),
);
