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
  clipboardAutoClearTimeout: number; // 0 = disabled, otherwise milliseconds (e.g., 15000, 30000, 60000)
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
