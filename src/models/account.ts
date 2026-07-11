export type FieldType = "text" | "password" | "email" | "number" | "textarea";

export interface AccountField {
  id: string;
  accountId: string;
  label: string;
  type: FieldType;
  value: string;
  order: number;
}

export interface Account {
  id: string;
  title: string;
  tags: string[];
  favorite: boolean;
  fields: AccountField[];
}
