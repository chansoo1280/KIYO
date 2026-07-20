export type FieldType = "text" | "password" | "email" | "number" | "textarea";

export interface AccountField {
  id: string;
  accountId?: number;
  label: string;
  type: FieldType;
  value: string;
  order: number;
}

export interface Account {
  id: number;
  templateId: number;
  title: string;
  description?: string;
  tags: string[];
  favorite: boolean;
  fields: AccountField[];
  createdAt: number;
  updatedAt: number;
  // URL/domain fields for Autofill Service integration
  websiteUrl?: string;    // Original URL entered by user (e.g., "https://www.naver.com/login")
  domain?: string;        // Normalized domain for web autofill matching (e.g., "naver.com")
  packageName?: string;   // Android package name for app autofill matching (e.g., "com.nhn.android.search")
}

export interface Template {
  id: number;
  name: string;
  fields: AccountField[];
}

export type FontSize = "small" | "medium" | "large";

// App-wide settings (stored in DB settings table, NOT in data files)
export interface AppSettings {
  theme: "light" | "dark";
  autoLockTime: number;
  lockEnabled: boolean;
  fontSize: FontSize;
  biometricEnabled: boolean; // Whether to use biometric authentication for autofill
}

// Alias for backward compatibility with tests
export type Setting = AppSettings;

// File-specific metadata (stored in data files)
export interface FileMetadata {
  id: number;
  version: string;
  createdAt: number;
}

// Alias for backward compatibility with tests
export type Metadata = FileMetadata;