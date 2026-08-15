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
  getAutofillAccounts(): Promise<{ username: string; password: string; domain: string | null; title?: string }[]>;
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
            a.id === updatedAccount.id ? updatedAccount : a
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
          // Check if autofill service is enabled
          const autofillStatus = await KiyoAutofill.isAutofillEnabled();
          if (!autofillStatus.enabled || !autofillStatus.isOurService) {
            // Autofill is not enabled or not our service, skip sync
            return;
          }

          const accounts = await get().getAutofillAccounts();
          const accountsJson = JSON.stringify(accounts);
          const result = await KiyoAutofill.syncAccountsFromReact({
            accountsJson,
          });

          if (result.success) {
            console.log(
              `[Autofill] Synced ${result.syncedCount} accounts, ${result.errorCount} errors`
            );
          } else {
            console.warn(
              `[Autofill] Sync completed with errors: ${result.errorCount} errors`
            );
          }
        } catch (error) {
          console.error("[Autofill] Failed to sync accounts:", error);
        }
      },

      // Get accounts formatted for autofill (username, password, domain)
      getAutofillAccounts: async () => {
        const accounts = get().accounts;
        const autofillAccounts = [];

        for (const account of accounts) {
          // Find username field (email or text type)
          let username = "";
          let password = "";

          for (const field of account.fields) {
            if (field.type === "email" || field.type === "text") {
              // Prefer email for username, but take first text/email field
              if (!username || field.type === "email") {
                username = field.value;
              }
            } else if (field.type === "password") {
              password = field.value;
            }
          }

          // Skip if we don't have both username and password
          if (!username || !password) {
            continue;
          }

          // Determine domain: prefer account.domain, otherwise try to extract from websiteUrl
          let domain = account.domain ?? null;
          if (!domain && account.websiteUrl) {
            try {
              const url = new URL(account.websiteUrl);
              domain = url.hostname;
            } catch (e) {
              // Invalid URL, keep domain as null
            }
          }

          autofillAccounts.push({
            username,
            password,
            domain,
            title: account.title,
          });
        }

        return autofillAccounts;
      },
    }),
    { name: "AccountStore" }
  ),
);

// Dev/테스트 환경에서 Zustand store 디버그용 노출
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__KIYO_DEBUG__ = {
    ...((window as unknown as Record<string, unknown>).__KIYO_DEBUG__ ?? {}),
    getAccountStore: () => {
      const state = useAccountStore.getState();
      return {
        accountsCount: state.accounts.length,
        initialized: state.initialized,
        isLoading: state.isLoading,
      };
    },
  };
}