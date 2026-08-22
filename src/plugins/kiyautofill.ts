import { registerPlugin } from "@capacitor/core";

export interface AutofillStatus {
  enabled: boolean;
  hasService: boolean;
  servicePackageName: string | null;
  isOurService: boolean;
  isEnabled: boolean;
  hasEnabledServices: boolean;
  serviceClassName: string | null;
}

export interface AutofillServiceInfo {
  servicePackageName: string | null;
  isOurService: boolean;
  isEnabled: boolean;
  hasEnabledServices: boolean;
  serviceClassName: string | null;
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
  authRequired?: boolean;
  message?: string;
}

export interface KiyoAutofillPlugin {
  isAutofillEnabled(): Promise<AutofillStatus>;
  requestAutofillEnable(): Promise<void>;
  openAppForAuth(): Promise<void>;
  ping(): Promise<PingResponse>;
  getAutofillServiceInfo(): Promise<AutofillServiceInfo>;
  syncAccountsFromReact(options: {
    accountsJson: string;
  }): Promise<SyncAccountsResult>;
  getAccountCount(): Promise<CountResult>;
  clearAllAccounts(): Promise<ClearAccountsResult>;
}

export interface CountResult {
  count: number;
  authRequired?: boolean;
  message?: string;
}

export interface ClearAccountsResult {
  deletedCount: number;
  success: boolean;
  authRequired?: boolean;
  message?: string;
}

const KiyoAutofill = registerPlugin<KiyoAutofillPlugin>("KiyoAutofill", {
  web: () => import("./kiyautofill.web").then((m) => new m.KiyoAutofillWeb()),
});

export { KiyoAutofill };
