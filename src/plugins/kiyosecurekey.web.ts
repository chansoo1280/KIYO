import { WebPlugin } from "@capacitor/core";
import type {
  SecureKeyPlugin,
  StoreKeyOptions,
  UnlockKeyResult,
  HasKeyResult,
  BiometryAvailability,
} from "@/plugins/kiyosecurekey";

export class SecureKeyWeb extends WebPlugin implements SecureKeyPlugin {
  async storeKey(_options: StoreKeyOptions): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    console.warn("SecureKey: storeKey not available on web");
  }

  async unlockKeyWithBiometric(_options: { vaultId: string }): Promise<UnlockKeyResult> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    console.warn("SecureKey: unlockKeyWithBiometric not available on web");
    throw new Error("Biometric authentication not available on web");
  }

  async deleteKey(_options: { vaultId: string }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    console.warn("SecureKey: deleteKey not available on web");
  }

  async hasKey(_options: { vaultId: string }): Promise<HasKeyResult> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    console.warn("SecureKey: hasKey not available on web");
    return { exists: false };
  }

  async isBiometryAvailable(): Promise<BiometryAvailability> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    console.warn("SecureKey: isBiometryAvailable not available on web");
    return { available: false, type: "none" };
  }
}