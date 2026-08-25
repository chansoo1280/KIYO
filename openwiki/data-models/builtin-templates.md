---
type: data-model
title: Built-in Templates
description: Built-in template definitions for quick account creation with predefined field structures.
tags: [data-model, template, account, fields]
---
# Built-in Templates

Built-in templates provide predefined field structures for common account types, enabling users to quickly create accounts with appropriate fields pre-configured. Each template includes field labels, types, default values, and optional settings like icons and sort order.

## Purpose

Built-in templates serve to:
1. **Simplify Account Creation**: Provide ready-made field structures for common account types
2. **Ensure Consistency**: Standardize how similar account types are structured across the vault
3. **Improve Discoverability**: Offer categorized templates with icons and descriptions
4. **Support Localization**: Include Korean labels and descriptions for Korean-speaking users

## Data Structure

Defined in `/src/models/template.ts`:

```typescript
export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  fields: TemplateField[];
  createdAt: number;
  updatedAt: number;
}

export interface TemplateField {
  label: string;
  type: FieldType;
  defaultValue: string;
  options?: string[]; // For select types
  placeholder?: string;
}
```

The `FieldType` enum is defined in `/src/models/account.ts` and includes types like `text`, `email`, `password`, `textarea`, `select`, `totp`, `url`, etc.

## Implementation

The built-in templates are stored in `/src/data/builtinTemplates.ts` as an array of template objects (without `id` and timestamps, which are generated when the template is used):

```typescript
export const BUILTIN_TEMPLATES: Omit<Template, "id" | "createdAt" | "updatedAt">[] = [
  // Template definitions...
];
```

### Template Examples

1. **Login Template** (`로그인`)
   - Fields: Website/App, ID/Email, Password, 2FA Secret Key (TOTP), Memo
   - Icon: 🔐
   - Sort Order: 0

2. **API Key Template** (`API 키`)
   - Fields: Service Name, API Key, API Secret, Endpoint, Memo
   - Icon: 🔑
   - Sort Order: 1

3. **Credit/Debit Card Template** (`신용/체크카드`)
   - Fields: Card Name, Card Number, Expiry Date (MM/YY), CVC, Card Type, Memo
   - Icon: 💳
   - Sort Order: 2
   - Card Type options: Visa, Mastercard, Amex, JCB, 기타

4. **Bank Account Template** (`은행 계좌`)
   - Fields: Bank Name, Account Number, Depositor, Bank Code/Routing Number, Memo
   - Icon: 🏦
   - Sort Order: 3

5. **Wi-Fi Template** (`Wi-Fi`)
   - Fields: SSID, Password, Security Method, Memo
   - Icon: 📶
   - Sort Order: 4
   - Security Method options: WPA2-PSK, WPA3, WEP, Open

6. **Secure Memo Template** (`보안 메모`)
   - Fields: Title, Content
   - Icon: 📝
   - Sort Order: 5

## Usage

### In Template Store

Built-in templates are loaded into the template store (`/src/store/templateStore.ts`) and made available for users to select when creating new accounts or custom templates.

### In Account Creation

When users select a built-in template:
1. The template's fields are copied to the new account
2. Default values from the template are applied
3. Users can modify field values as needed
4. The template association is not preserved (accounts are independent copies)

### In Template Management

Users can:
- Edit built-in templates to create custom templates
- Delete custom templates (built-in templates cannot be deleted)
- Reorder templates via sortOrder

## Related Components

- **Data Model**: `/openwiki/models/template.md`
- **Template Store**: `/openwiki/frontend/state-management.md` (templateStore section)
- **Account Creation UI**: `/openwiki/frontend/pages/account-edit.md`
- **Template Management**: `/openwiki/frontend/pages/templates.md`
- **Website Presets**: `/openwiki/data-models/website-presets.md` (often used together with templates)

## Extending Templates

To add a new built-in template:
1. Add a new object to the `BUILTIN_TEMPLATES` array in `/src/data/builtinTemplates.ts`
2. Follow the existing structure with label, type, defaultValue, and optional options/placeholder
3. Provide meaningful Korean labels and descriptions
4. Assign an appropriate icon and sortOrder
5. Consider adding relevant categories if grouping by purpose

## Source

- File: `/src/data/builtinTemplates.ts`
- Type definitions: `/src/models/template.ts` and `/src/models/account.ts` (for FieldType)
- Usage: `/src/store/templateStore.ts`, `/src/pages/Templates/`, `/src/pages/Accounts/AccountEdit.tsx`