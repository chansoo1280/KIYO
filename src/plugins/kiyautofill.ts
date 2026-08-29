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
  securityDowngrade?: boolean;
  securityUpgrade?: boolean;
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

/**
 * Platform abstraction contract mirroring the native `AutofillPlatformBridge` interface.
 *
 * TypeScript-side type definition only — the Native Plugin API contract and existing
 * React component usage are unchanged. OS-dependent capabilities only; sync policy
 * (key handling, downgrade/upgrade, auth retry) is native-side (AutofillSyncManager)
 * and intentionally absent here.
 */
export interface AutofillPlatformBridge {
  isAutofillEnabled(): Promise<AutofillStatus>;
  openAutofillSettings(): Promise<void>;
  deliverAccountsForAutofill(options: { accountsJson: string }): Promise<void>;
}

const KiyoAutofill = registerPlugin<KiyoAutofillPlugin>("KiyoAutofill", {
  web: () => import("./kiyautofill.web").then((m) => new m.KiyoAutofillWeb()),
});

export { KiyoAutofill };
