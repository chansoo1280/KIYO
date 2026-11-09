import { registerPlugin } from "@capacitor/core";

export interface StoreKeyOptions {
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
  unlockKeyWithBiometric(): Promise<UnlockKeyResult>;
  deleteKey(): Promise<void>;
  hasKey(): Promise<HasKeyResult>;
  isBiometryAvailable(): Promise<BiometryAvailability>;
}

const SecureKey = registerPlugin<SecureKeyPlugin>("SecureKey", {
  web: () => import("./kiyosecurekey.web").then((m) => new m.SecureKeyWeb()),
});

export { SecureKey };