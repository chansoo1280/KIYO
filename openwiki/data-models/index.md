# Files

- [Account Model](account.md) - Account and AccountField shapes plus AppSettings and FileMetadata.
- [AutofillAccount (Kotlin)](autofill-account.md) - Kotlin data class for autofill credentials persisted in the SQLCipher autofill DB; the native counterpart to React Account.
- [Built-in Templates](builtin-templates.md) - BUILTIN_TEMPLATES dataset shipped with the app — read-only starter templates (Login, WiFi, Credit Card).
- [Dev Accounts (Seed Data)](dev-accounts.md) - devAccounts seed dataset loaded into newly created vaults so the React UI has demo content for screenshots and demos.
- [Field Types](field-types.md) - FieldType union used by AccountField and TemplateField; rendered by inputs.
- [Icon Registry](icons.md) - Emoji icon registry (ICON_OPTIONS) used by the template IconPicker; distinct from the Lucide SVG icons in components/icons.tsx.
- [Template Model](template.md) - Template and TemplateField shapes plus DEFAULT_TEMPLATE_FIELDS baseline.
- [KiyoVaultData](vault.md) - The vault snapshot type that flows through encryption, persistence, autofill sync, and import/export.
- [Website Presets](website-presets.md) - WebsitePreset type plus the websitePresets data and query helpers (searchPresets, getPresetsByCategory) used by the WebsiteSelector.
