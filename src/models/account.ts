import type { FieldType } from "@/models/fieldTypes";

export type { FieldType } from "@/models/fieldTypes";

export interface AccountField {
  id: string;
  accountId?: number;
  label: string;
  type: FieldType;
  value: string;
  order: number;
  options?: string[];
}

export interface Account {
  id: number;
  templateId: string;
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
  packageNames?: string[];  // Multiple package names for autofill matching
}

export type FontSize = "small" | "medium" | "large";
// PR 1: AppSettings/Setting dead types removed (db.settings drop, settingsStore는 zustand localStorage).