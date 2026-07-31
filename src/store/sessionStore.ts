import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";

export interface SessionState {
  activeFileName: string | null;
  cryptoKey: CryptoKey | null;
  salt: Uint8Array | null;
  lastSyncError: string | null;
  lastSyncErrorTime: number | null;
  lastSyncTime: number | null;
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
  clearCryptoKey: () => Promise<void>;
  clearSession: () => Promise<void>;
  setSyncError: (error: string | null) => void;
  clearSyncError: () => void;
  setLastSyncTime: (time: number | null) => void;
}

export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set) => ({
        activeFileName: null,
        cryptoKey: null,
        salt: null,
        lastSyncError: null,
        lastSyncErrorTime: null,
        lastSyncTime: null,

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

        clearCryptoKey: async () => {
          set({ cryptoKey: null });
        },

        clearSession: async () => {
          set({ activeFileName: null, cryptoKey: null, salt: null });
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
      }),
      {
        name: "kiyo-session",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          activeFileName: state.activeFileName,
          salt: state.salt,
          lastSyncTime: state.lastSyncTime,
        }),
      },
    ),
    { name: "session-store" },
  ),
);
