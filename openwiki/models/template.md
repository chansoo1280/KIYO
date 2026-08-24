---
type: model
title: Template Model
description: Represents a field template that defines a set of fields for a particular type of account (e.g., login, credit card, identity).
tags: [model, template, data-structure]
---

# Template Model

The Template model defines a set of fields for a particular type of account (e.g., login, credit card, identity). Templates are used to create new accounts with a predefined structure, ensuring consistency and reducing manual entry.

## Source File
- `/src/models/template.ts`

## TypeScript Interface

```typescript
export interface Template {
  id: string;
  name: string;
  fields: FieldDescriptor[]; // Array of field descriptors
}
```

### FieldDescriptor Type

```typescript
export interface FieldDescriptor {
  id: string; // Unique identifier for the field
  type: FieldType; // Type of field (from FieldTypes)
  label: string; // Display label for the field
  required?: boolean; // Whether the field is required (default: false)
}
```

## Properties Explained

| Property | Type | Description |
|---------|------|-------------|
| `id` | string | Unique identifier for the template (UUID) |
| `name` | string | Human-readable name of the template (e.g., "Login", "Credit Card") |
| `fields` | FieldDescriptor[] | Array defining the fields that accounts using this template will have |
| `FieldDescriptor.id` | string | Unique ID for the field within the template |
| `FieldDescriptor.type` | FieldType | Type of field (text, password, email, etc.) |
| `FieldDescriptor.label` | string | Label shown to the user in the UI |
| `FieldDescriptor.required` | boolean (optional) | If true, the field must be filled when creating an account |

## Usage Across Layers

### Frontend Components
- **TemplateList**: Displays available templates in a list
- **TemplateEdit**: Form for creating/editing templates, allowing users to add/remove/reorder fields
- **AccountEdit**: When creating a new account, displays a dropdown to select a template; the selected template determines which fields are shown
- **AccountDetail**: Uses the account's templateId to look up the template and render fields accordingly

### Zustand Stores
- **templateStore**:
  - Loads/saves templates to/from IndexedDB
  - Provides CRUD operations (add, update, delete, set favorite)
  - Supports filtering/searching by name
  - Default templates are built-in (see `/src/data/builtinTemplates.ts`)

### Database Layer
- **templateTable** (`src/database/templateTable.ts`):
  - Dexie.js table typed to Template interface
  - Indexes on `name` for efficient lookup
  - No encryption needed as templates contain no sensitive data

### Account Creation Flow
1. User selects a template (or creates account without template)
2. Store creates new Account instance with:
   - Generated `id`
   - Empty values for standard fields (username, password, etc.)
   - Empty `fields` array populated based on template's `FieldDescriptor` objects
   - `templateId` set to selected template's ID
   - Timestamps set to current time
3. User fills in the form (standard fields + custom fields from template)
4. On save, account is encrypted and stored to IndexedDB

## Validation Rules

### Template Validation
- `id`: Must be non-empty string (UUID)
- `name`: Must be non-empty string (max 100 chars)
- `fields`: Must be non-empty array
- Each `FieldDescriptor`:
  - `id`: Must be non-empty string, unique within template
  - `type`: Must be one of the valid FieldType values
  - `label`: Must be non-empty string (max 100 chars)
  - `required`: If present, must be boolean

### Example Validation Errors
- Duplicate field IDs within a template
- Invalid field type (e.g., "invalid-type")
- Empty label
- Name exceeding 100 characters

## Relationships

### Account Relationship
- Many Accounts can reference one Template via `templateId`
- Template defines the structure of `Account.fields`
- Changing a template does not affect existing accounts (they retain their original template)

### FieldTypes Relationship
- Each `FieldDescriptor.type` must be a valid value from the FieldTypes union
- Field types determine input component and validation in UI

## Built-in Templates

Default templates are defined in `/src/data/builtinTemplates.ts` and include:
- **Login**: username (text), password (password), otp (otp)
- **Email**: username (email), password (password)
- **Credit Card**: name (text), number (text), expiry (text), cvv (text)
- **Identity**: firstName (text), lastName (text), address (address), phone (phone)
- **Passport**: passportNumber (text), expirationDate (text), nationality (text)

## Example Template

### Login Template
```json
{
  "id": "login-template",
  "name": "Login",
  "fields": [
    { "id": "username", "type": "text", "label": "Username or Email", "required": true },
    { "id": "password", "type": "password", "label": "Password", "required": true },
    { "id": "otp-secret", "type": "otp", "label": "OTP Secret (Base32)", "required": false }
  ]
}
```

### Credit Card Template
```json
{
  "id": "credit-card-template",
  "name": "Credit Card",
  "fields": [
    { "id": "cardholder-name", "type": "text", "label": "Cardholder Name", "required": true },
    { "id": "card-number", "type": "text", "label": "Card Number", "required": true },
    { "id": "expiry-date", "type": "text", "label": "Expiry Date (MM/YY)", "required": true },
    { "id": "cvv", "type": "text", "label": "CVV", "required": true }
  ]
}
```

## Security Considerations

- Templates contain no sensitive data; they define structure only
- Template data is stored in plaintext in IndexedDB
- No encryption is applied to template data
- Changing a template does not decrypt or re-encrypt existing account data