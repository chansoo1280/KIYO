import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Account } from "@/models/account";
import {
  syncDatabaseToFile,
} from "@/database/db";
import { accountTable } from "@/database/accountTable";
import { Capacitor } from "@capacitor/core";
import { KiyoAutofill } from "@/plugins/kiyautofill";
import { useSessionStore } from "@/store/sessionStore";

export interface AccountState {
  accounts: Account[];
  initialized: boolean;

  initialize: () => Promise<void>;
  setAccounts: (accounts: Account[]) => Promise<void>;
  addAccount: (account: Account) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  getAccountById: (id: number) => Account | undefined;
  clearAccounts: () => Promise<void>;
  syncToAutofill: () => Promise<void>;
}

export const useAccountStore = create<AccountState>()(
  devtools(
    (set, get) => ({
      accounts: [],
      initialized: false,
      initialize: async () => {
        const accounts = await accountTable.getAll();

        set({
          accounts,
          initialized: true,
        });

        // Sync to Android Autofill after initialization
        await get().syncToAutofill();
      },
      setAccounts: async (accounts) => {
        set({ accounts });
        await accountTable.saveAll(accounts);
        const sessionState = useSessionStore.getState();
        await syncDatabaseToFile({
          activeFileName: sessionState.activeFileName,
          cryptoKey: sessionState.cryptoKey,
          salt: sessionState.salt,
          clearSyncError: sessionState.clearSyncError,
          setSyncError: sessionState.setSyncError,
        });
        await get().syncToAutofill();
      },

      addAccount: async (account) => {
        const newAccount = await accountTable.create({
          ...account,
        });
        set((state) => ({ accounts: [newAccount, ...state.accounts] }));

        const sessionState = useSessionStore.getState();
        const allAccounts = get().accounts;
        await accountTable.saveAll(allAccounts, sessionState.cryptoKey ?? undefined);
        await syncDatabaseToFile({
          activeFileName: sessionState.activeFileName,
          cryptoKey: sessionState.cryptoKey,
          salt: sessionState.salt,
          clearSyncError: sessionState.clearSyncError,
          setSyncError: sessionState.setSyncError,
        });
        await get().syncToAutofill();
        return newAccount;
      },

      updateAccount: async (account) => {
        const updatedAccount = { ...account, updatedAt: Date.now() };
        await accountTable.update(updatedAccount);
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === updatedAccount.id ? updatedAccount : a,
          ),
        }));

        const sessionState = useSessionStore.getState();
        const allAccounts = get().accounts;
        await accountTable.saveAll(allAccounts, sessionState.cryptoKey ?? undefined);
        await syncDatabaseToFile({
          activeFileName: sessionState.activeFileName,
          cryptoKey: sessionState.cryptoKey,
          salt: sessionState.salt,
          clearSyncError: sessionState.clearSyncError,
          setSyncError: sessionState.setSyncError,
        });
        await get().syncToAutofill();
      },

      deleteAccount: async (id) => {
        await accountTable.delete(id);
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        }));

        const sessionState = useSessionStore.getState();
        const allAccounts = get().accounts;
        await accountTable.saveAll(allAccounts, sessionState.cryptoKey ?? undefined);
        await syncDatabaseToFile({
          activeFileName: sessionState.activeFileName,
          cryptoKey: sessionState.cryptoKey,
          salt: sessionState.salt,
          clearSyncError: sessionState.clearSyncError,
          setSyncError: sessionState.setSyncError,
        });
        await get().syncToAutofill();
      },

      getAccountById: (id) => get().accounts.find((a) => a.id === id),

      clearAccounts: async () => {
        set({ accounts: [], initialized: false });
        await accountTable.clear();
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