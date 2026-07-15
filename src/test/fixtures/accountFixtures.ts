import type { Account, AccountField } from "../../models/account";

export const createTestField = (
  overrides: Partial<AccountField> = {},
): AccountField => ({
  id: "field-1",
  label: "Field",
  type: "text",
  value: "value",
  order: 0,
  ...overrides,
});

export const createTestAccount = (
  overrides: Partial<Account> = {},
): Account => {
  const now = 1700000000000;

  return {
    id: 1,
    templateId: 1,
    title: "Test Account",
    tags: ["tag1"],
    favorite: false,
    fields: [
      createTestField({
        id: "1-1",
        label: "Username",
        value: "user",
      }),
      createTestField({
        id: "1-2",
        label: "Password",
        type: "password",
        value: "secret",
        order: 1,
      }),
    ],
    createdAt: now - 1000,
    updatedAt: now,
    ...overrides,
  };
};

export const createTestAccounts = (count = 1): Account[] => {
  return Array.from({ length: count }, (_, index) =>
    createTestAccount({
      id: index + 1,
      title: `Test Account ${index + 1}`,
      fields: [
        createTestField({
          id: `${index + 1}-1`,
        }),
      ],
    }),
  );
};

/**
 * 다양한 필드 타입을 포함한 복잡한 Account 생성
 * 데이터 복원/암호화 테스트용 (getTestFields()의 인덱스 3~12와 일치)
 */
export const createComplexAccount = (
  overrides: Partial<Account> = {},
): Account => ({
  id: 1,
  templateId: 1,
  title: "Complex Account",
  tags: ["complex", "test"],
  favorite: true,
  fields: [
    createTestField({
      id: "c-1",
      label: "Text",
      type: "text",
      value: "hello world",
      order: 0,
    }),
    createTestField({
      id: "c-2",
      label: "Password",
      type: "password",
      value: "p@ssw0rd!#$%^&*()_+-=[]{}|;':\",./<>?`~",
      order: 1,
    }),
    createTestField({
      id: "c-3",
      label: "Email",
      type: "email",
      value: "test@example.com",
      order: 2,
    }),
    createTestField({
      id: "c-4",
      label: "Number",
      type: "number",
      value: "12345",
      order: 3,
    }),
    createTestField({
      id: "c-5",
      label: "URL",
      type: "text",
      value: "https://example.com",
      order: 4,
    }),
    createTestField({
      id: "c-6",
      label: "OTP",
      type: "text",
      value: "otpauth://totp/Example:user?secret=JBSWY3DPEHPK3PXP",
      order: 5,
    }),
    createTestField({
      id: "c-7",
      label: "Long Text",
      type: "text",
      value: "Lorem ipsum dolor sit amet. ".repeat(10),
      order: 6,
    }),
    createTestField({
      id: "c-8",
      label: "Unicode",
      type: "text",
      value: "한글 日本語 🎉🚀💻",
      order: 7,
    }),
    createTestField({
      id: "c-9",
      label: "JSON String",
      type: "text",
      value: JSON.stringify({ nested: { object: [1, 2, 3] } }),
      order: 8,
    }),
    createTestField({
      id: "c-10",
      label: "Multiline",
      type: "textarea",
      value: "Line 1\nLine 2\tTabbed\r\nWindows line ending",
      order: 9,
    }),
  ],
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  ...overrides,
});
