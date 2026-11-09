# Files

- [Account Detail Page](account-detail.md) - View account details, copy credentials, and perform account actions.
- [AccountEdit Page](account-edit.md) - New/edit account form composed of sub-components (Title, Fields, PasswordGenerator, WebsiteSelector).
- [AccountList Page](accounts.md) - Account index page with search, AND-tag filter, sort, and TemplatePicker-driven create flow.
- [Auth Page](auth.md) - PIN unlock and biometric unlock. Both paths converge on initializeStores + navigate(/accounts).
- [AutofillTestLogin Page](autofill-test-login.md) - Standalone login form inside the React WebView that exposes native autofill for manual and E2E testing.
- [CreateVaultPage](create-vault.md) - Multi-step wizard to create a new vault file (NameStep + PinStep with Stepper).
- [Home Page](home.md) - Vault file dashboard. Lists existing vault files; supports open, close, create, import, export.
- [RootRedirect](root-redirect.md) - Entry-point page that orchestrates preload of stores and redirects to /accounts or /auth based on vault state.
- [Settings Page](settings.md) - Settings index + SecuritySection, UISection, DataSection, AutofillSection. AppInfoDialog and PinChangeDialog are modal sub-flows.
- [Templates Pages](templates.md) - TemplateList and TemplateEdit pages with sub-components IconPicker and TemplateFieldEditor.
