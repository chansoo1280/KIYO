import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Account } from "@/models/account";
import { useSessionStore } from "@/store/sessionStore";
import { requestSave } from "@/persistence/persistencePort";
import { Capacitor } from "@capacitor/core";
import { KiyoAutofill } from "@/plugins/kiyautofill";
import { useSettingsStore } from "@/store/settingsStore";
import { mapError } from "@/utils/mapError";

const nextAccountId = (accounts: Account[]): number => {
  if (accounts.length === 0) return 1;
  return Math.max(...accounts.map((a) => a.id)) + 1;
};

export interface AccountState {
  accounts: Account[];
  init: (accounts: Account[]) => void;
  getAll: () => Account[];
  addAccount: (account: Omit<Account, "id">) => Promise<Account>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
  getAccountById: (id: number) => Account | undefined;
  clearAccounts: () => Promise<void>;
  syncToAutofill: () => Promise<void>;
  getAutofillAccounts(): Promise<{
    username: string;
    password: string;
    domain: string | null;
    title?: string;
    packageNames?: string[];
    packageName?: string | null;
  }[]>;
  syncStatus: "idle" | "syncing" | "synced" | "failed";
  syncError: string | null;
}

export const useAccountStore = create<AccountState>()(
  devtools(
    (set, get) => ({
      accounts: [],
      syncStatus: "idle",
      syncError: null,

      init: (accounts: Account[]) => {
        set({ accounts });
      },

      getAll: () => get().accounts,

      addAccount: async (account) => {
        const newAccount = {
          ...account,
          id: nextAccountId(get().accounts),
        };
        set({ syncStatus: "syncing", syncError: null });
        try {
          set((state) => ({ accounts: [newAccount, ...state.accounts] }));
          await requestSave();
          set({ syncStatus: "synced", syncError: null });
          return newAccount;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
          set({ syncStatus: "failed", syncError: message });
          throw error;
        }
      },

      updateAccount: async (account) => {
        const updatedAccount = { ...account, updatedAt: Date.now() };
        set({ syncStatus: "syncing", syncError: null });
        try {
          set((state) => ({
            accounts: state.accounts.map((a) =>
              a.id === updatedAccount.id ? updatedAccount : a
            ),
          }));
          await requestSave();
          set({ syncStatus: "synced", syncError: null });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
          set({ syncStatus: "failed", syncError: message });
          throw error;
        }
      },

      deleteAccount: async (id) => {
        set({ syncStatus: "syncing", syncError: null });
        try {
          set((state) => ({
            accounts: state.accounts.filter((a) => a.id !== id),
          }));
          await requestSave();
          set({ syncStatus: "synced", syncError: null });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
          set({ syncStatus: "failed", syncError: message });
          throw error;
        }
      },

      clearAccounts: async () => {
        set({ syncStatus: "syncing", syncError: null });
        try {
          set({ accounts: [] });
          await requestSave();
          set({ syncStatus: "synced", syncError: null });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
          set({ syncStatus: "failed", syncError: message });
          throw error;
        }
      },

      getAccountById: (id) => get().accounts.find((a) => a.id === id),

      syncToAutofill: async () => {
        if (Capacitor.getPlatform() !== "android") {
          return;
        }

        const { autofillEnabled } = useSettingsStore.getState();
        if (!autofillEnabled) {
          return;
        }

        try {
          const autofillStatus = await KiyoAutofill.isAutofillEnabled();
          if (!autofillStatus.enabled || !autofillStatus.isOurService) {
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
            console.error(
              "[Autofill] Failed to sync accounts:",
              error instanceof Error ? error.message : String(error),
              error
            );
          }
        }
      },

      getAutofillAccounts: async () => {
        const accounts = get().accounts;
        const autofillAccounts = [];

        for (const account of accounts) {
          let username = "";
          let password = "";

          for (const field of account.fields) {
            if (field.type === "email" || field.type === "text") {
              if (!username || field.type === "email") {
                username = field.value;
              }
            } else if (field.type === "password") {
              password = field.value;
            }
          }

          if (!username || !password) {
            continue;
          }

          let domain = account.domain ?? null;
          if (!domain && account.websiteUrl) {
            try {
              const url = new URL(account.websiteUrl);
              domain = url.hostname;
            } catch {
              // Invalid URL, keep domain as null
            }
          }

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
  )
);

// Dev/테스트 환경에서 Zustand store 디버그용 노출
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__KIYO_DEBUG__ = {
    ...((window as unknown as Record<string, unknown>).__KIYO_DEBUG__ ?? {}),
    getAccountStore: () => {
      const state = useAccountStore.getState();
      return {
        accountsCount: state.accounts.length,
      };
    },
  };
}
