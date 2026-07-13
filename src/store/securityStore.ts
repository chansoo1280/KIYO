import { create } from "zustand";

interface SecurityState {
  activeFileName: string | null;

  cryptoKey: CryptoKey | null;

  salt: Uint8Array | null;

  setActiveFileName: (fileName: string | null) => void;

  setCryptoKey: (key: CryptoKey, salt: Uint8Array) => void;

  clearSecurity: () => void;
}

export const useSecurityStore = create<SecurityState>()((set) => ({
  activeFileName: null,

  cryptoKey: null,

  salt: null,

  setActiveFileName: (fileName) =>
    set({
      activeFileName: fileName,
    }),

  setCryptoKey: (key, salt) =>
    set({
      cryptoKey: key,
      salt,
    }),

  clearSecurity: () =>
    set({
      activeFileName: null,
      cryptoKey: null,
      salt: null,
    }),
}));
