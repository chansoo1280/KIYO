import { WebPlugin } from "@capacitor/core";
import type {
  KiyoAutofillPlugin,
  AutofillStatus,
  AutofillServiceInfo,
  PingResponse,
  SyncAccountsResult,
  CountResult,
} from "@/plugins/kiyautofill";

export class KiyoAutofillWeb extends WebPlugin implements KiyoAutofillPlugin {
  private sessionValue: { key?: string; isEncrypted: boolean } | null = null;
  async isAutofillEnabled(): Promise<AutofillStatus> {
    console.warn("KiyoAutofill: isAutofillEnabled not available on web");
    return {
      enabled: false,
      hasService: false,
      servicePackageName: null,
      isOurService: false,
      isEnabled: false,
      hasEnabledServices: false,
      serviceClassName: null,
    };
  }

  async requestAutofillEnable(): Promise<void> {
    console.warn("KiyoAutofill: requestAutofillEnable not available on web");
  }

  async ping(): Promise<PingResponse> {
    return {
      pong: true,
      timestamp: Date.now(),
      message: "KiyoAutofill web fallback - plugin not available on web",
    };
  }

  async getAutofillServiceInfo(): Promise<AutofillServiceInfo> {
    console.warn("KiyoAutofill: getAutofillServiceInfo not available on web");
    return {
      servicePackageName: null,
      isOurService: false,
      isEnabled: false,
      hasEnabledServices: false,
      serviceClassName: null,
    };
  }

  async syncAccountsFromReact(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { accountsJson: _accountsJson }: { accountsJson: string },
  ): Promise<SyncAccountsResult> {
    console.warn("KiyoAutofill: syncAccountsFromReact not available on web");
    return {
      syncedCount: 0,
      errorCount: 0,
      success: false,
    };
  }

  async getAccountCount(): Promise<CountResult> {
    console.warn("KiyoAutofill: getAccountCount not available on web");
    return { count: 0 };
  }

  async setBiometricEnabled({ enabled }: { enabled: boolean }): Promise<void> {
    console.warn(
      "KiyoAutofill: setBiometricEnabled not available on web",
      enabled,
    );
  }

  async getBiometricEnabled(): Promise<{ enabled: boolean }> {
    console.warn("KiyoAutofill: getBiometricEnabled not available on web");
    return { enabled: true };
  }

  async saveSession(options: { key?: string; isEncrypted: boolean }): Promise<void> {
    this.sessionValue = options;
  }

  async clearSession(): Promise<void> {
    this.sessionValue = null;
  }

  async hasSession(): Promise<{ hasSession: boolean }> {
    return { hasSession: this.sessionValue !== null };
  }
}
