export type FieldType =
  | "text"
  | "password"
  | "email"
  | "url"
  | "number"
  | "textarea"
  | "totp"
  | "select"
  | "date"
  | "secureText"
  | "secureTextarea";

export const ENCRYPTED_FIELD_TYPES: FieldType[] = [
  "password",
  "totp",
  "secureText",
  "secureTextarea",
];

export function isEncryptedType(type: FieldType): boolean {
  return ENCRYPTED_FIELD_TYPES.includes(type);
}

export function getFieldTypeLabel(type: FieldType): string {
  const labels: Record<FieldType, string> = {
    text: "텍스트",
    password: "비밀번호",
    email: "이메일",
    url: "URL",
    number: "숫자",
    textarea: "긴 텍스트",
    totp: "TOTP (2FA)",
    select: "선택",
    date: "날짜",
    secureText: "암호화 텍스트",
    secureTextarea: "암호화 긴 텍스트",
  };
  return labels[type] ?? type;
}

export function getFieldTypeIcon(type: FieldType): string {
  const icons: Record<FieldType, string> = {
    text: "📝",
    password: "🔒",
    email: "📧",
    url: "🔗",
    number: "🔢",
    textarea: "📄",
    totp: "🔐",
    select: "📋",
    date: "📅",
    secureText: "🔐",
    secureTextarea: "🔐",
  };
  return icons[type] ?? "📝";
}

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; encrypted: boolean }[] = [
  { value: "text", label: "텍스트", encrypted: false },
  { value: "password", label: "비밀번호", encrypted: true },
  { value: "email", label: "이메일", encrypted: false },
  { value: "url", label: "URL", encrypted: false },
  { value: "number", label: "숫자", encrypted: false },
  { value: "textarea", label: "긴 텍스트", encrypted: false },
  { value: "totp", label: "TOTP (2FA)", encrypted: true },
  { value: "select", label: "선택", encrypted: false },
  { value: "date", label: "날짜", encrypted: false },
  { value: "secureText", label: "암호화 텍스트", encrypted: true },
  { value: "secureTextarea", label: "암호화 긴 텍스트", encrypted: true },
];