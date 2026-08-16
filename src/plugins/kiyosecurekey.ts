import { registerPlugin } from "@capacitor/core";

export interface StoreKeyOptions {
  vaultId: string;
  key: string;
}

export interface UnlockKeyResult {
  key: string;
}

export interface HasKeyResult {
  exists: boolean;
}

export interface BiometryAvailability {
  available: boolean;
  type: "fingerprint" | "face" | "none";
}

export interface SecureKeyPlugin {
  storeKey(options: StoreKeyOptions): Promise<void>;
  unlockKeyWithBiometric(options: { vaultId: string }): Promise<UnlockKeyResult>;
  deleteKey(options: { vaultId: string }): Promise<void>;
  hasKey(options: { vaultId: string }): Promise<HasKeyResult>;
  isBiometryAvailable(): Promise<BiometryAvailability>;
}

const SecureKey = registerPlugin<SecureKeyPlugin>("SecureKey", {
  web: () => import("./kiyosecurekey.web").then((m) => new m.SecureKeyWeb()),
});

export { SecureKey };