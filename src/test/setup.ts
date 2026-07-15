import { vi } from "vitest";
import "fake-indexeddb/auto";
import type { Account, Template, AccountField } from "../models/account";

export const getTestAccounts = (): Account[] => {
  return [
    {
      id: 1,
      templateId: 1,
      title: "Account 1",
      tags: ["tag1", "tag2"],
      favorite: true,
      fields: [
        {
          id: "1-1",
          label: "Field 1",
          type: "text",
          value: "value1",
          order: 0,
        },
        {
          id: "1-2",
          label: "Field 2",
          type: "password",
          value: "secret1",
          order: 1,
        },
      ],
      createdAt: Date.now() - 1000,
      updatedAt: Date.now(),
    },
    {
      id: 2,
      templateId: 2,
      title: "Account 2",
      tags: ["tag2"],
      favorite: false,
      fields: [
        {
          id: "2-1",
          label: "Email",
          type: "email",
          value: "test@example.com",
          order: 0,
        },
      ],
      createdAt: Date.now() - 2000,
      updatedAt: Date.now() - 500,
    },
  ];
};

export const getTestTemplates = (): Template[] => [
  {
    id: 1,
    name: "Template 1",
    fields: [{ id: "f1", label: "Field 1", type: "text", value: "", order: 0 }],
  },
  {
    id: 2,
    name: "Template 2",
    fields: [
      { id: "f2", label: "Email", type: "email", value: "", order: 0 },
      {
        id: "f3",
        label: "Password",
        type: "password",
        value: "",
        order: 1,
      },
    ],
  },
];

// 통합된 테스트 필드 - 모든 테스트에서 공통으로 사용
// 테스트에서 필요한 만큼 slice해서 사용
export const getTestFields = (): AccountField[] => [
  // 기본 필드들 (getTestAccounts에서 사용)
  {
    id: "1-1",
    label: "Field 1",
    type: "text",
    value: "value1",
    order: 0,
  },
  {
    id: "1-2",
    label: "Field 2",
    type: "password",
    value: "secret1",
    order: 1,
  },
  {
    id: "2-1",
    label: "Email",
    type: "email",
    value: "test@example.com",
    order: 0,
  },
  // 복잡한 데이터 테스트용 필드들 (인덱스 3~12)
  {
    id: "c-1",
    label: "Text",
    type: "text",
    value: "hello world",
    order: 0,
  },
  {
    id: "c-2",
    label: "Password",
    type: "password",
    value: "p@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?`~",
    order: 1,
  },
  {
    id: "c-3",
    label: "Email",
    type: "email",
    value: "test@example.com",
    order: 2,
  },
  {
    id: "c-4",
    label: "Number",
    type: "number",
    value: "12345",
    order: 3,
  },
  {
    id: "c-5",
    label: "URL",
    type: "text",
    value: "https://example.com",
    order: 4,
  },
  {
    id: "c-6",
    label: "OTP",
    type: "text",
    value: "otpauth://totp/Example:user?secret=JBSWY3DPEHPK3PXP",
    order: 5,
  },
  {
    id: "c-7",
    label: "Long Text",
    type: "text",
    value: "Lorem ipsum dolor sit amet. ".repeat(10),
    order: 6,
  },
  {
    id: "c-8",
    label: "Unicode",
    type: "text",
    value: "한글 日本語 🎉🚀💻",
    order: 7,
  },
  {
    id: "c-9",
    label: "JSON String",
    type: "text",
    value: JSON.stringify({ nested: { object: [1, 2, 3] } }),
    order: 8,
  },
  {
    id: "c-10",
    label: "Multiline",
    type: "textarea",
    value: "Line 1\nLine 2\tTabbed\r\nWindows line ending",
    order: 9,
  },
  // 데이터 무결성 테스트용 필드들 (인덱스 13~17)
  {
    id: "i-1",
    label: "Password",
    type: "password",
    value: "p@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?`~",
    order: 0,
  },
  {
    id: "i-2",
    label: "Note",
    type: "text",
    value: "Line 1\nLine 2\tTabbed\r\nWindows line ending",
    order: 1,
  },
  {
    id: "i-3",
    label: "JSON",
    type: "text",
    value: JSON.stringify({
      unicode: "🎉🚀💻",
      korean: "안녕하세요",
      japanese: "こんにちは",
      chinese: "你好",
      special: "<script>alert('xss')</script>",
    }),
    order: 2,
  },
  {
    id: "i-4",
    label: "Empty Value",
    type: "text",
    value: "",
    order: 3,
  },
  {
    id: "i-5",
    label: "Normal Value",
    type: "text",
    value: "normal",
    order: 4,
  },
  // 암호화 복잡한 테스트용 필드들 (인덱스 18~22)
  {
    id: "e-1",
    label: "Field1",
    type: "text",
    value: "value1",
    order: 0,
  },
  {
    id: "e-2",
    label: "Field2",
    type: "password",
    value: "secret2",
    order: 1,
  },
  {
    id: "e-3",
    label: "Field3",
    type: "email",
    value: "test@test.com",
    order: 2,
  },
  {
    id: "e-4",
    label: "Field4",
    type: "number",
    value: "999",
    order: 3,
  },
  {
    id: "e-5",
    label: "Field5",
    type: "text",
    value: "한글 English 🌟",
    order: 4,
  },
];

export const getComplexTestTemplates = (): Template[] => [
  {
    id: 1,
    name: "Complex Template",
    fields: [
      { id: "f1", label: "Text", type: "text", value: "", order: 0 },
      {
        id: "f2",
        label: "Password",
        type: "password",
        value: "",
        order: 1,
      },
      { id: "f3", label: "Email", type: "email", value: "", order: 2 },
      { id: "f4", label: "Number", type: "number", value: "", order: 3 },
      { id: "f5", label: "URL", type: "text", value: "", order: 4 },
      { id: "f6", label: "OTP", type: "text", value: "", order: 5 },
      { id: "f7", label: "Long Text", type: "text", value: "", order: 6 },
      { id: "f8", label: "Unicode", type: "text", value: "", order: 7 },
      {
        id: "f9",
        label: "JSON String",
        type: "text",
        value: "",
        order: 8,
      },
      {
        id: "f10",
        label: "Multiline",
        type: "textarea",
        value: "",
        order: 9,
      },
    ],
  },
];

// Mock TextEncoder and TextDecoder
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
// Export mock for use in tests
export {};
