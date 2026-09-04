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
    void _options;
    console.warn("SecureKey: storeKey not available on web");
  }

  async unlockKeyWithBiometric(): Promise<UnlockKeyResult> {
    console.warn("SecureKey: unlockKeyWithBiometric not available on web");
    throw new Error("Biometric authentication not available on web");
  }

  async deleteKey(): Promise<void> {
    console.warn("SecureKey: deleteKey not available on web");
  }

  async hasKey(): Promise<HasKeyResult> {
    console.warn("SecureKey: hasKey not available on web");
    return { exists: false };
  }

  async isBiometryAvailable(): Promise<BiometryAvailability> {
    console.warn("SecureKey: isBiometryAvailable not available on web");
    return { available: false, type: "none" };
  }
}