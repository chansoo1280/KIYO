# Files

- [AutofillPlatformBridge](autofill-platform-bridge.md) - Internal contract wrapping AutofillManager and Settings.Secure queries for testing without coupling to system services.
- [AutofillSyncManager](autofill-sync-manager.md) - Sync policy with AuthOutcome retry loop, SyncResult data class, and SyncAuthNavigator interface.
- [KiyoAutofillPlugin (Native)](kiyautofill-plugin.md) - Capacitor plugin exposing autofill status, syncAccountsFromReact, and openAutofillSettings to the React WebView.
- [KiyoFilePlugin](kiyofile-plugin.md) - Capacitor plugin for vault backup file operations (SAF save/open, URI read/write, folder pick).
- [SecureKeyPlugin (Native)](securekey-plugin.md) - Capacitor plugin for biometric vault unlock. Includes storeKey, unlockKeyWithBiometric, hasKey, deleteKey.
