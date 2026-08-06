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
  defaultValue?: string;
  options?: string[];
}

// 기본 템플릿 필드 정의 (TemplatePicker, AccountEdit에서 공통 사용)
export const DEFAULT_TEMPLATE_FIELDS: TemplateField[] = [
  { label: "제목", type: "text", defaultValue: "" },
  { label: "아이디/이메일", type: "email", defaultValue: "" },
  { label: "비밀번호", type: "password", defaultValue: "" },
  { label: "메모", type: "textarea", defaultValue: "" },
];