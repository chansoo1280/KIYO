# Capacitor Plugins

Documentation for the Capacitor plugins used in the KIYO app.

## Files

- [AutofillSyncManager](autofill-sync-manager.md) - Manages sync policy including security downgrade reset, repo init, security upgrade flag, and pending-sync auth retry.
- [AutofillPlatformBridge](autofill-platform-bridge.md) - Provides OS capabilities only (autofill status query, settings screen, data delivery) + Android implementation.
- [KiyoAutofillPlugin](kiyofill-plugin.md) - The Capacitor plugin that delegates to AutofillSyncPlugin and guards against missing bridge for JVM tests.
- [TypeScript Interfaces](kiyautofill-ts.md) - TypeScript interface definitions for the plugin (see `src/plugins/kiyautofill.ts`).
