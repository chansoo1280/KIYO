import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import { fromBase64 } from "@/crypto/crypto.utils";
import { importKey } from "@/crypto/encryption";
import { fileTable } from "@/database/fileTable";

// Web Crypto API types (available globally in browser environments)
type CryptoKey = globalThis.CryptoKey;

// Migration: lastAutofillAccountCount → lastSyncedAutofillCount
const migrateLastAutofillCount = (state: unknown): unknown => {
  if (!state || typeof state !== "object") return state;
  const s = state as Record<string, unknown>;
  if ("lastAutofillAccountCount" in s && !("lastSyncedAutofillCount" in s)) {
    s.lastSyncedAutofillCount = s.lastAutofillAccountCount;
    delete s.lastAutofillAccountCount;
  }
  return state;
};

export interface SessionState {
  activeFileName: string | null;
  cryptoKey: CryptoKey | null;
  salt: Uint8Array | null;
  initialized: boolean;
  lastSyncError: string | null;
  lastSyncErrorTime: number | null;
  lastSyncTime: number | null;
  lastSyncedAutofillCount: number | null;
  setSession: ({
    fileName,
    cryptoKey,
    salt,
  }: {
    fileName: string | null;
    cryptoKey?: CryptoKey;
    salt?: Uint8Array;
  }) => Promise<void>;
  setCryptoKey: (key: CryptoKey, salt: Uint8Array) => Promise<void>;
  setCryptoKeyFromBase64: (keyBase64: string, salt: Uint8Array) => Promise<void>;
  clearCryptoKey: () => Promise<void>;
  clearSession: () => Promise<void>;
  setSyncError: (error: string | null) => void;
  clearSyncError: () => void;
  setLastSyncTime: (time: number | null) => void;
  setLastSyncedAutofillCount: (count: number | null) => void;
}

export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set) => ({
        activeFileName: null,
        cryptoKey: null,
        salt: null,
        initialized: false,
        lastSyncError: null,
        lastSyncErrorTime: null,
        lastSyncTime: null,
        lastSyncedAutofillCount: null,

        setSession: async ({ fileName, cryptoKey, salt }) => {
          set((state) => ({
            activeFileName: fileName,
            cryptoKey: cryptoKey ?? state.cryptoKey,
            salt: salt ?? state.salt,
          }));
        },

        setCryptoKey: async (key, salt) => {
          set({ cryptoKey: key, salt });
        },

        setCryptoKeyFromBase64: async (keyBase64, salt) => {
          const keyData = fromBase64(keyBase64);
          const key = await importKey(keyData, "AES-GCM", ["encrypt", "decrypt"]);
          set({ cryptoKey: key, salt });
        },

        clearCryptoKey: async () => {
          set({ cryptoKey: null });
        },

        clearSession: async () => {
          set({ activeFileName: null, cryptoKey: null, salt: null, initialized: false });
        },

        setSyncError: (error: string | null) => {
          set({
            lastSyncError: error,
            lastSyncErrorTime: error ? Date.now() : null,
          });
        },

        clearSyncError: () => {
          set({ lastSyncError: null, lastSyncErrorTime: null });
        },

        setLastSyncTime: (time: number | null) => {
          set({ lastSyncTime: time });
        },

        setLastSyncedAutofillCount: (count: number | null) => {
          set({ lastSyncedAutofillCount: count });
        },
      }),

      {
        name: "kiyo-session",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          activeFileName: state.activeFileName,
          salt: state.salt,
          lastSyncTime: state.lastSyncTime,
          lastSyncedAutofillCount: state.lastSyncedAutofillCount,
        }),
        migrate: migrateLastAutofillCount,
      },
    ),
    { name: "session-store" },
  ),
);

// Dev/테스트 환경에서 Zustand store 디버그용 노출
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__KIYO_DEBUG__ = {
    ...((window as unknown as Record<string, unknown>).__KIYO_DEBUG__ ?? {}),
    getSession: () => {
      const state = useSessionStore.getState();
      return {
        activeFileName: state.activeFileName,
        hasCryptoKey: !!state.cryptoKey,
        hasSalt: !!state.salt,
        initialized: state.initialized,
      };
    },
    getFiles: async () => {
      const all = await fileTable.getAllFiles();
      return all.map((f) => ({ fileName: f.fileName, id: f.id, encrypted: f.encrypted }));
    },
  };
}