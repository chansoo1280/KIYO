import type { Account, Template } from "../models/account";

// Initial accounts for development
export const devAccounts: Account[] = [
  {
    id: 1,
    templateId: 1,
    title: "Google",
    tags: ["email", "work"],
    favorite: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      {
        id: "1",
        accountId: 1,
        label: "Email",
        type: "email",
        value: "user@gmail.com",
        order: 1,
      },
      {
        id: "2",
        accountId: 1,
        label: "Password",
        type: "password",
        value: "password123",
        order: 2,
      },
    ],
  },
  {
    id: 2,
    templateId: 2,
    title: "GitHub",
    tags: ["dev", "work"],
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: [
      {
        id: "3",
        accountId: 2,
        label: "Username",
        type: "text",
        value: "developer",
        order: 1,
      },
      {
        id: "4",
        accountId: 2,
        label: "Token",
        type: "password",
        value: "ghp_xxxxxxxxxxxx",
        order: 2,
      },
    ],
  },
];

// Fixed templates
export const fixedTemplates: Template[] = [
  {
    id: 1,
    name: "로그인",
    fields: [
      {
        id: "email",
        label: "이메일",
        type: "email",
        value: "",
        order: 1,
      },
      {
        id: "password",
        label: "비밀번호",
        type: "password",
        value: "",
        order: 2,
      },
    ],
  },
  {
    id: 2,
    name: "API 키",
    fields: [
      {
        id: "api-key",
        label: "API Key",
        type: "password",
        value: "",
        order: 1,
      },
      {
        id: "secret",
        label: "Secret",
        type: "password",
        value: "",
        order: 2,
      },
    ],
  },
  {
    id: 3,
    name: "카드",
    fields: [
      {
        id: "card-number",
        label: "카드 번호",
        type: "text",
        value: "",
        order: 1,
      },
      {
        id: "expiry-date",
        label: "유효기간",
        type: "text",
        value: "",
        order: 2,
      },
      {
        id: "cvc",
        label: "CVC",
        type: "password",
        value: "",
        order: 3,
      },
    ],
  },
];
