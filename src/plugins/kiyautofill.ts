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
  setBiometricEnabled(options: { enabled: boolean }): Promise<void>;
  getBiometricEnabled(): Promise<{ enabled: boolean }>;
  saveSession(options: { key?: string; isEncrypted: boolean }): Promise<void>;
  clearSession(): Promise<void>;
  hasSession(): Promise<{ hasSession: boolean }>;
}

export interface CountResult {
  count: number;
}

const KiyoAutofill = registerPlugin<KiyoAutofillPlugin>("KiyoAutofill", {
  web: () => import("./kiyautofill.web").then((m) => new m.KiyoAutofillWeb()),
});

export { KiyoAutofill };
