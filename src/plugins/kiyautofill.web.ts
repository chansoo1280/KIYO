import { WebPlugin } from "@capacitor/core";
import type {
  KiyoAutofillPlugin,
  AutofillStatus,
  AutofillServiceInfo,
  PingResponse,
  SyncAccountsResult,
  CountResult,
} from "./kiyautofill";

export class KiyoAutofillWeb extends WebPlugin implements KiyoAutofillPlugin {
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

  async syncAccountsFromReact({}): Promise<SyncAccountsResult> {
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
    console.warn("KiyoAutofill: setBiometricEnabled not available on web", enabled);
  }

  async getBiometricEnabled(): Promise<{ enabled: boolean }> {
    console.warn("KiyoAutofill: getBiometricEnabled not available on web");
    return { enabled: true };
  }
}
