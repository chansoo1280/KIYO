export type FieldType =
  | "text"
  | "password"
  | "email"
  | "url"
  | "number"
  | "textarea"
  | "totp"
  | "select"
  | "date";

export interface FieldTypeOption {
  value: FieldType;
  label: string;
  icon: string;
  placeholder: string;
}

export const FIELD_TYPE_OPTIONS: FieldTypeOption[] = [
  { value: "text", label: "텍스트", icon: "📝", placeholder: "입력하세요" },
  { value: "password", label: "비밀번호", icon: "🔒", placeholder: "비밀번호" },
  { value: "email", label: "이메일", icon: "📧", placeholder: "이메일 주소" },
  { value: "url", label: "URL", icon: "🔗", placeholder: "https://example.com" },
  { value: "number", label: "숫자", icon: "🔢", placeholder: "숫자" },
  { value: "textarea", label: "긴 텍스트", icon: "📄", placeholder: "내용을 입력하세요" },
  { value: "totp", label: "TOTP (2FA)", icon: "🔐", placeholder: "TOTP 시크릿 키" },
  { value: "select", label: "선택", icon: "📋", placeholder: "선택하세요" },
  { value: "date", label: "날짜", icon: "📅", placeholder: "날짜 선택" },
];

export function getFieldTypeOption(type: FieldType): FieldTypeOption {
  return FIELD_TYPE_OPTIONS.find((opt) => opt.value === type) ?? FIELD_TYPE_OPTIONS[0];
}

export function getFieldTypeLabel(type: FieldType): string {
  return getFieldTypeOption(type).label;
}

export function getFieldTypeIcon(type: FieldType): string {
  return getFieldTypeOption(type).icon;
}

export function getFieldTypePlaceholder(type: FieldType): string {
  return getFieldTypeOption(type).placeholder;
}