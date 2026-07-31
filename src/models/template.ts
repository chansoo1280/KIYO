import type { FieldType } from "@/models/fieldTypes";

export interface Template {
  id: string;
  name: string;
  description?: string;
  icon: string;
  sortOrder: number;
  fields: TemplateField[];
  createdAt: number;
  updatedAt: number;
}

export interface TemplateField {
  label: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
}