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

export interface Setting {
  theme: "light" | "dark";
  autoLockTime: number;
  lockEnabled: boolean;
}

export interface Metadata {
  id: number;
  version: string;
  createdAt: number;
}
