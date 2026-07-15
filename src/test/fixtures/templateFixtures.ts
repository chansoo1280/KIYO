// src/test/fixtures/templateFixtures.ts

import type { Template } from "../../models/account";
import type { AccountField } from "../../models/account";

/**
 * 기본 TemplateField 생성
 */
export const createTestTemplateField = (
  overrides: Partial<AccountField> = {},
): AccountField => ({
  id: "template-field-1",
  label: "Field",
  type: "text",
  value: "",
  order: 0,
  ...overrides,
});

/**
 * 기본 Template 생성
 */
export const createTestTemplate = (
  overrides: Partial<Template> = {},
): Template => ({
  id: 1,
  name: "Test Template",
  fields: [
    createTestTemplateField({
      id: "template-field-1",
      label: "Username",
      type: "text",
      order: 0,
    }),
    createTestTemplateField({
      id: "template-field-2",
      label: "Password",
      type: "password",
      order: 1,
    }),
  ],
  ...overrides,
});

/**
 * 여러 개의 Template 생성
 */
export const createTestTemplates = (count = 1): Template[] => {
  return Array.from({ length: count }, (_, index) =>
    createTestTemplate({
      id: index + 1,
      name: `Test Template ${index + 1}`,
    }),
  );
};

/**
 * 다양한 필드 타입을 포함한 복잡한 Template 생성
 * 데이터 복원/암호화 테스트용
 */
export const createComplexTestTemplate = (
  overrides: Partial<Template> = {},
): Template => ({
  id: 1,
  name: "Complex Template",
  fields: [
    createTestTemplateField({
      id: "complex-text",
      label: "Text",
      type: "text",
      order: 0,
    }),

    createTestTemplateField({
      id: "complex-password",
      label: "Password",
      type: "password",
      order: 1,
    }),

    createTestTemplateField({
      id: "complex-email",
      label: "Email",
      type: "email",
      order: 2,
    }),

    createTestTemplateField({
      id: "complex-number",
      label: "Number",
      type: "number",
      order: 3,
    }),

    createTestTemplateField({
      id: "complex-url",
      label: "URL",
      type: "text",
      order: 4,
    }),

    createTestTemplateField({
      id: "complex-otp",
      label: "OTP",
      type: "text",
      order: 5,
    }),

    createTestTemplateField({
      id: "complex-unicode",
      label: "Unicode",
      type: "text",
      order: 6,
    }),
  ],
  ...overrides,
});
