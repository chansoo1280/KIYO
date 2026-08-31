import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Account } from "@/models/account";
import {
  enqueuePersistVaultSnapshot,
} from "@/database/syncQueue";
import { accountTable } from "@/database/accountTable";
import { Capacitor } from "@capacitor/core";
import { KiyoAutofill } from "@/plugins/kiyautofill";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { mapError } from "@/utils/mapError";

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
  getAutofillAccounts(): Promise<{ username: string; password: string; domain: string | null; title?: string; packageNames?: string[]; packageName?: string | null }[]>;
}

export const useAccountStore = create<AccountState>()(
  devtools(
    (set, get) => ({
      accounts: [],
      initialized: false,
      isLoading: false,

      // Private: persist current accounts to File only (autofill sync is manual)
      _persistAccounts: async () => {
        await enqueuePersistVaultSnapshot(() => {
          const sessionState = useSessionStore.getState();
          return {
            activeFileName: sessionState.activeFileName,
            cryptoKey: sessionState.cryptoKey,
            salt: sessionState.salt,
            clearSyncError: sessionState.clearSyncError,
            setSyncError: sessionState.setSyncError,
          };
        });
      },

      loadAccounts: async () => {
        // Store-side guard: 이미 initialized면 즉시 return.
        // RootRedirect 경로(preload)와 self-load 경로(AccountList/Templates)가
        // 같은 store를 공유하므로 중복 호출 흡수. 호출자가 await해도 안전.
        if (get().initialized) return;
        set({ isLoading: true });
        try {
          const sessionState = useSessionStore.getState();
          const accounts = await accountTable.getAll(sessionState.cryptoKey ?? undefined);

          set({
            accounts,
            initialized: true,
            isLoading: false,
          });
        } catch (error) {
          console.error("Failed to load accounts:", error instanceof Error ? error.message : String(error));
          useSessionStore.getState().setSyncError(mapError(error));
          set({ isLoading: false });
          // 호출자(RootRedirect 등)가 인지할 수 있도록 rethrow
          throw error;
        }
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

        // Check app-level autofill enabled setting
        const { autofillEnabled } = useSettingsStore.getState();
        if (!autofillEnabled) {
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
            if (import.meta.env.DEV) {
              console.log(
                `[Autofill] Synced ${result.syncedCount} accounts, ${result.errorCount} errors`
              );
            }
          } else {
            if (import.meta.env.DEV) {
              console.warn(
                `[Autofill] Sync completed with errors: ${result.errorCount} errors`
              );
            }
          }
        } catch (error) {
          useSessionStore.getState().setSyncError(mapError(error));
          if (import.meta.env.DEV) {
            console.error("[Autofill] Failed to sync accounts:", error instanceof Error ? error.message : String(error), error);
          }
        }
      },

      // Get accounts formatted for autofill (username, password, domain, package names)
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
            } catch {
              // Invalid URL, keep domain as null
            }
          }

          // Include package names for Android app autofill matching
          const packageNames = account.packageNames ?? [];
          const packageName = account.packageName ?? null;

          autofillAccounts.push({
            username,
            password,
            domain,
            title: account.title,
            packageNames,
            packageName,
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