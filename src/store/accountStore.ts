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
  isLoading: boolean;

  loadAccounts: () => Promise<void>;
  addAccount: (account: Account) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  getAccountById: (id: number) => Account | undefined;
  clearAccounts: () => Promise<void>;
  syncToAutofill: () => Promise<void>;
  _persistAccounts: () => Promise<void>;
}

export const useAccountStore = create<AccountState>()(
  devtools(
    (set, get) => ({
      accounts: [],
      initialized: false,
      isLoading: false,

      // Private: persist current accounts to File + Autofill
      _persistAccounts: async () => {
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

      loadAccounts: async () => {
        set({ isLoading: true });
        const sessionState = useSessionStore.getState();
        const accounts = await accountTable.getAll(sessionState.cryptoKey ?? undefined);

        set({
          accounts,
          initialized: true,
          isLoading: false,
        });

        // Sync to Android Autofill after initialization
        await get().syncToAutofill();
      },

      addAccount: async (account) => {
        const sessionState = useSessionStore.getState();
        const newAccount = await accountTable.create(account, sessionState.cryptoKey ?? undefined);
        set((state) => ({ accounts: [newAccount, ...state.accounts] }));
        await get()._persistAccounts();
        return newAccount;
      },

      updateAccount: async (account) => {
        const sessionState = useSessionStore.getState();
        const updatedAccount = { ...account, updatedAt: Date.now() };
        await accountTable.update(updatedAccount, sessionState.cryptoKey ?? undefined);
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === updatedAccount.id ? updatedAccount : a,
          ),
        }));
        await get()._persistAccounts();
      },

      deleteAccount: async (id) => {
        await accountTable.delete(id);
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        }));
        await get()._persistAccounts();
      },

      getAccountById: (id) => get().accounts.find((a) => a.id === id),

      clearAccounts: async () => {
        await accountTable.clear();
        set({ accounts: [], initialized: false });
        await get()._persistAccounts();
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