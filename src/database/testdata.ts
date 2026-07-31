import type { Account } from "@/models/account";

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


