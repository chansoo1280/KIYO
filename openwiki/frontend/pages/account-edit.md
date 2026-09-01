---
type: page
title: AccountEdit Page
description: New/edit account form composed of sub-components (Title, Fields, PasswordGenerator, WebsiteSelector).
tags: [page, account-edit, form, create, edit]
---
# AccountEdit Page
Source File: /src/pages/Accounts/AccountEdit/index.tsx
Routes: /accounts/new (create), /accounts/:id/edit (edit)
Responsibility
- Renders the form for creating or editing an account.
- Pulls the template from URL state (create) or from the existing account (edit).
- Composes sub-components for title, fields, password generation, and website selection.
Sub-Components
- AccountTitleSection - title, icon, favorite, tags.
- AccountFieldsSection - one FieldEditor per field.
- FieldEditor - field type-aware input (Input / PasswordField).
- PasswordGenerator - generates a new password with length + character-set controls.
- WebsiteSelector - preset search + custom domain entry.
Workflow
1. Read template id from useLocation state (create) or derive from account.templateId (edit).
2. Build the initial fields array from the template (each field starts empty unless the template has defaults).
3. On submit, call accountStore.addAccount or updateAccount.
Focused Tests
- src/pages/Accounts/AccountEdit/AccountEdit.test.tsx covers create + edit flows including password generator integration.
Source Anchors
- Page: /src/pages/Accounts/AccountEdit/index.tsx
- Sub-components: /src/pages/Accounts/AccountEdit/components/
- Password generator: /src/pages/Accounts/AccountEdit/components/PasswordGenerator.tsx
- Website selector: /src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx