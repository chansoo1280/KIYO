import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clearActiveFileInfo, saveActiveFileInfo } from "../database/db";

interface SessionState {
  activeFileName: string | null;
  cryptoKey: CryptoKey | null;
  salt: Uint8Array | null;
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
  clearSession: () => Promise<void>;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      activeFileName: null,
      cryptoKey: null,
      salt: null,

      setSession: async ({ fileName, cryptoKey, salt }) => {
        set({ activeFileName: fileName, cryptoKey, salt });
        if (fileName) {
          await saveActiveFileInfo(fileName, salt || undefined);
        } else {
          await clearActiveFileInfo();
        }
      },

      setCryptoKey: async (key, salt) => {
        set({ cryptoKey: key, salt });
        const { activeFileName } = get();
        if (activeFileName) {
          await saveActiveFileInfo(activeFileName, salt);
        }
      },

      clearSession: async () => {
        set({ activeFileName: null, cryptoKey: null, salt: null });
        await clearActiveFileInfo();
      },
    }),
    {
      name: "kiyo-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeFileName: state.activeFileName,
      }),
    },
  ),
);
