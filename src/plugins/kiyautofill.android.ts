import { registerPlugin } from '@capacitor/core';
import type {
  KiyoAutofillPlugin,
} from './kiyautofill';

// Android-specific extended interfaces for account management
export interface AutofillAccount {
  id: number;
  username: string;
  password: string;
  title?: string | null;
  packageName?: string | null;
  appName?: string | null;
  domain?: string | null;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
}

export interface AutofillAccountInput {
  username: string;
  password: string;
  title?: string;
  packageName?: string;
  appName?: string;
  domain?: string;
  favorite?: boolean;
}

export interface AutofillAccountUpdate {
  id: number;
  username?: string;
  password?: string;
  title?: string;
  packageName?: string;
  appName?: string;
  domain?: string;
  favorite?: boolean;
}

export interface SyncResult {
  syncedCount: number;
  errorCount: number;
  totalProcessed: number;
}

export interface GetAccountsResult {
  accounts: AutofillAccount[];
  count: number;
}

export interface AddAccountResult {
  id: number;
  success: boolean;
}

export interface UpdateAccountResult {
  updated: boolean;
  id: number;
}

export interface DeleteAccountResult {
  deleted: boolean;
  id: number;
}

export interface ToggleFavoriteResult {
  success: boolean;
  id: number;
}

export interface CountResult {
  count: number;
}

export interface ClearResult {
  deletedCount: number;
  success: boolean;
}

export interface GetAccountsOptions {
  packageName?: string;
  domain?: string;
  username?: string;
}

// Extended plugin interface with Android-specific account management methods
export interface KiyoAutofillAndroidPlugin extends KiyoAutofillPlugin {
  syncAccounts(accounts: AutofillAccountInput[]): Promise<SyncResult>;
  getAccounts(options?: GetAccountsOptions): Promise<GetAccountsResult>;
  addAccount(account: AutofillAccountInput): Promise<AddAccountResult>;
  updateAccount(account: AutofillAccountUpdate): Promise<UpdateAccountResult>;
  deleteAccount(id: number): Promise<DeleteAccountResult>;
  toggleFavorite(id: number): Promise<ToggleFavoriteResult>;
  getAccountCount(): Promise<CountResult>;
  clearAllAccounts(): Promise<ClearResult>;
}

// Register the Android-specific plugin
// The native implementation is in android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.java
const KiyoAutofillAndroid = registerPlugin<KiyoAutofillAndroidPlugin>('KiyoAutofill');

export { KiyoAutofillAndroid };