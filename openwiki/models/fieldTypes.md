---
type: model
title: FieldTypes Model
description: Defines the types of fields that can be used in templates and accounts (e.g., text, password, email, URL, OTP).
tags: [model, fieldtypes, data-structure]
---

# FieldTypes Model

The FieldTypes model defines the available types of fields that can be used in templates and accounts. Each field type determines the kind of data that can be stored and how it is validated and displayed.

## Source File
- `/src/models/fieldTypes.ts`

## TypeScript Type

```typescript
export type FieldType = 
  | 'text'
  | 'password'
  | 'email'
  | 'url'
  | 'otp'
  | 'phone'
  | 'address'
  | 'name'
  | 'company';
```

## Field Type Descriptions

| Field Type | Description | Typical Use | Validation |
|------------|-------------|-------------|------------|
| `text` | Single-line text input | General text fields | None (or max length) |
| `password` | Masked password input | Passwords, PINs | Min length |
| `email` | Email address input | Email addresses | Email format |
| `url` | URL input | Website URLs | URL format |
| `otp` | One-time password input | TOTP seeds, backup codes | Alphanumeric, length |
| `phone` | Phone number input | Phone numbers | Phone format |
| `address` | Multi-line address input | Postal addresses | None |
| `name` | Person's name input | Full names | None |
| `company` | Company/organization input | Company names | None |

## Usage in Templates

Field types are used in the `Template` model to define the structure of an account's custom fields.

### Template Field Descriptor

```typescript
export interface FieldDescriptor {
  id: string; // Unique identifier for the field
  type: FieldType; // Type of field (from FieldTypes)
  label: string; // Display label for the field
  required?: boolean; // Whether the field is required (default: false)
}
```

### Example Template Using FieldTypes

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

## Usage Across Layers

### Frontend Components
- **AccountEdit/TemplateEdit**: Renders appropriate input component based on field type:
  - `text` → `<input type="text">`
  - `password` → `<input type="password">`
  - `email` → `<input type="email">`
  - `url` → `<input type="url">`
  - `otp` → `<input type="text">` (with special handling for Base32)
  - `phone` → `<input type="tel">`
  - `address` → `<textarea>`
  - `name` → `<input type="text">`
  - `company` → `<input type="text">`

### Validation
- Form validation uses field type to determine validation rules:
  - `email`: Matches email regex pattern
  - `url`: Matches URL regex pattern
  - `otp`: Validates Base32 format (optional)
  - `phone`: Validates phone number format (optional)
  - `password`: Enforces minimum length (configurable)
  - Others: May enforce max length or pattern if specified

### Database Storage
- Field type does not affect how data is stored in IndexedDB
- All custom field values are stored as strings
- Encryption/decryption applied to values regardless of field type

### Autofill Matching
- Certain field types influence autofill behavior:
  - `username`/`email` fields are checked for autofill suggestions
  - `password` fields are triggered for password saving
  - `otp` fields may trigger OTP-specific autofill

## Example FieldValues by Type

```json
{
  "text": "Some text value",
  "password": "encrypted_password_value",
  "email": "user@example.com",
  "url": "https://example.com",
  "otp": "JBSWY3DPEHPK3PXP",
  "phone": "+1-555-123-4567",
  "address": "123 Main St\\nAnytown, USA 12345",
  "name": "John Doe",
  "company": "Acme Corporation"
}
```

## Security Considerations

- Field type does not impact encryption: all custom field values are encrypted regardless of type
- Input components prevent XSS by escaping user input where necessary
- Password fields are masked in UI and memory
- OTP secrets are treated as sensitive data (encrypted at rest)