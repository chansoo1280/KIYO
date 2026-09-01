# Files

- [Dexie Schema](dexie-schema.md) - KiyoDatabase schema v13/v14 with accounts/templates/settings/metadata/files tables, PK changes, and Dexie migrations.
- [File Export (SAF)](file-export.md) - SAF (Storage Access Framework) backup operations on Android. Includes exportBackupFile, importBackupFile, writeBackupToUri, readBackupFromUri, and pickBackupFolder, plus web-download fallback.
- [File Storage (Vault Lifecycle)](file-storage.md) - Vault file CRUD operations, encryption pipeline (PBKDF2 + AES-GCM), multi-vault model with fileName PK, devAccounts seeding, and Documents-directory export.
- [Sync Queue](sync-queue.md) - Auto-save serialization queue with coalescing, drain helper, and debug surface.
- [Table Modules](table-modules.md) - accountTable, templateTable, fileTable CRUD + syncQueue that serializes auto-save writes and provides test/debug helpers.
