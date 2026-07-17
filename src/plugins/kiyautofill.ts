import { registerPlugin } from "@capacitor/core";

export interface AutofillStatus {
  enabled: boolean;
  hasService: boolean;
  servicePackageName: string | null;
}

export interface AutofillServiceInfo {
  servicePackageName: string | null;
  isOurService: boolean;
  isEnabled: boolean;
  hasEnabledServices: boolean;
}

export interface PingResponse {
  pong: boolean;
  timestamp: number;
  message: string;
}

export interface SyncAccountsResult {
  syncedCount: number;
  errorCount: number;
  success: boolean;
}

export interface KiyoAutofillPlugin {
  isAutofillEnabled(): Promise<AutofillStatus>;
  requestAutofillEnable(): Promise<void>;
  ping(): Promise<PingResponse>;
  getAutofillServiceInfo(): Promise<AutofillServiceInfo>;
  syncAccountsFromReact(options: {
    accountsJson: string;
  }): Promise<SyncAccountsResult>;
  getAccountCount(): Promise<CountResult>;
}

export interface CountResult {
  count: number;
}

const KiyoAutofill = registerPlugin<KiyoAutofillPlugin>("KiyoAutofill", {
  web: () => import("./kiyautofill.web").then((m) => new m.KiyoAutofillWeb()),
});

export { KiyoAutofill };
