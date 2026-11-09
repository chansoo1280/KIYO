# Files

- [Android E2E Tests](android-e2e-tests.md) - androidx.test E2E suites for autofill, autosave, and biometric unlock. Page objects and helpers for emulator-driven testing.
- [Android Unit Tests](android-unit-tests.md) - JUnit + Robolectric tests for the Kotlin autofill and security modules (DomainMatcher, FieldScorer, FieldScoringRules, AccountMapper, HtmlAttributeExtractor, KeystoreManager, DatabaseKeyManager, AutofillSyncManager, KiyoAutofillPlugin).
- [E2E Tests (Web / Playwright)](e2e-tests.md) - Playwright config and web E2E specs that exercise the React UI via headless Chromium against the Vite dev server.
- [Test Setup](test-setup.md) - Vitest setups (common, unit, integration) with mocks for Capacitor plugins, KiyoAutofill, Dexie table modules, and fake-indexeddb.
- [Unit Tests (Web)](unit-tests.md) - Vitest unit and integration suites covering crypto, stores, file storage, sync queue, and static-analysis regression.
