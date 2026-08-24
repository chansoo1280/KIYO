import type { Template, TemplateField } from "@/models/template";
import { BUILTIN_TEMPLATES } from "@/data/builtinTemplates";

/**
 * 기본 TemplateField 생성
 */
export const createTestTemplateField = (
  overrides: Partial<TemplateField> = {},
): TemplateField => ({
  label: "Field",
  type: "text",
  defaultValue: "",
  options: [],
  ...overrides,
});

/**
 * 기본 Template 생성
 */
export const createTestTemplate = (
  overrides: Partial<Template> = {},
): Template => ({
  id: "1",
  name: "Test Template",
  description: "",
  icon: "📋",
  sortOrder: 0,
  fields: [
    createTestTemplateField({
      label: "Username",
      type: "text",
      defaultValue: "",
      options: [],
    }),
    createTestTemplateField({
      label: "Password",
      type: "password",
      defaultValue: "",
      options: [],
    }),
  ],
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

/**
 * 여러 개의 Template 생성
 */
export const createTestTemplates = (count = 1): Template[] => {
  return Array.from({ length: count }, (_, index) =>
    createTestTemplate({
      id: `${index + 1}`,
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
  id: "1",
  name: "Complex Template",
  description: "",
  icon: "📋",
  sortOrder: 0,
  fields: [
    createTestTemplateField({
      label: "Text",
      type: "text",
      defaultValue: "",
      options: [],
    }),

    createTestTemplateField({
      label: "Password",
      type: "password",
      defaultValue: "",
      options: [],
    }),

    createTestTemplateField({
      label: "Email",
      type: "email",
      defaultValue: "",
      options: [],
    }),

    createTestTemplateField({
      label: "Number",
      type: "number",
      defaultValue: "",
      options: [],
    }),

    createTestTemplateField({
      label: "URL",
      type: "url",
      defaultValue: "",
      options: [],
    }),

    createTestTemplateField({
      label: "OTP",
      type: "totp",
      defaultValue: "",
      options: [],
    }),

    createTestTemplateField({
      label: "Unicode",
      type: "text",
      defaultValue: "",
      options: [],
    }),
  ],
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

/**
 * 내장 템플릿들 (BUILTIN_TEMPLATES) - 테스트용 타임스탬프 추가
 */
export const getBuiltinTemplates = (timestamp = Date.now()): Template[] => {
  return BUILTIN_TEMPLATES.map((t, i) => ({
    ...t,
    id: `builtin-${i}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
};