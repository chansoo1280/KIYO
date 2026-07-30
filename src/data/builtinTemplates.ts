import type { Template } from "../models/template";

export const BUILTIN_TEMPLATES: Omit<Template, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "로그인",
    description: "아이디/비밀번호 기반 로그인 계정",
    icon: "🔐",
    sortOrder: 0,
    fields: [
      { label: "웹사이트/앱", type: "url", placeholder: "https://example.com", defaultValue: "" },
      { label: "아이디/이메일", type: "email", defaultValue: "" },
      { label: "비밀번호", type: "password", defaultValue: "" },
      { label: "2FA 비밀키 (TOTP)", type: "totp", defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "API 키",
    description: "API 키/시크릿 관리",
    icon: "🔑",
    sortOrder: 1,
    fields: [
      { label: "서비스명", type: "text", defaultValue: "" },
      { label: "API Key", type: "password", defaultValue: "" },
      { label: "API Secret", type: "password", defaultValue: "" },
      { label: "엔드포인트", type: "url", defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "신용/체크카드",
    description: "카드번호, 유효기간, CVC 등",
    icon: "💳",
    sortOrder: 2,
    fields: [
      { label: "카드명", type: "text", defaultValue: "" },
      { label: "카드번호", type: "secureText", defaultValue: "" },
      { label: "유효기간 (MM/YY)", type: "secureText", defaultValue: "" },
      { label: "CVC", type: "password", defaultValue: "" },
      { label: "카드 종류", type: "select", options: ["Visa", "Mastercard", "Amex", "JCB", "기타"], defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "은행 계좌",
    description: "계좌번호, 은행명, 예금주 등",
    icon: "🏦",
    sortOrder: 3,
    fields: [
      { label: "은행명", type: "text", defaultValue: "" },
      { label: "계좌번호", type: "secureText", defaultValue: "" },
      { label: "예금주", type: "text", defaultValue: "" },
      { label: "은행 코드/라우팅번호", type: "text", defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "Wi-Fi",
    description: "SSID, 비밀번호, 암호화 방식",
    icon: "📶",
    sortOrder: 4,
    fields: [
      { label: "SSID", type: "text", defaultValue: "" },
      { label: "비밀번호", type: "password", defaultValue: "" },
      { label: "보안 방식", type: "select", options: ["WPA2-PSK", "WPA3", "WEP", "Open"], defaultValue: "" },
      { label: "메모", type: "textarea", defaultValue: "" },
    ],
  },
  {
    name: "보안 메모",
    description: "자유 형식의 암호화 메모",
    icon: "📝",
    sortOrder: 5,
    fields: [
      { label: "제목", type: "text", defaultValue: "" },
      { label: "내용", type: "secureTextarea", defaultValue: "" },
    ],
  },
];