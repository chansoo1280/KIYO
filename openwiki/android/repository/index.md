# Files

- [AccountMapper](account-mapper.md) - Parses the JSON account list sent from React (syncAccountsFromReact) into AutofillAccount instances.
- [AutofillDatabaseHelper](autofill-database-helper.md) - SQLCipher-backed main DB (kiyo_autofill.db) with auth-required DB_KEY, manual migrations, and v6 encryption drop-and-recreate.
- [AutofillIndexDatabaseHelper](autofill-index-database-helper.md) - Non-auth SQLCipher index DB (kiyo_autofill_index.db) storing only account_id + domain + package_names for pre-auth matching.
- [AutofillRepository](autofill-repository.md) - Top-level repository facade. Per-request fresh lifecycle, two-stage query (index → main), and one-shot sync that rebuilds both DBs.
- [Autofill DB Migrations](database-migrations.md) - PRAGMA user_version migration ladder for the main autofill DB (v0→v6) and the index DB (v0→v1).
- [DomainMatcher](domain-matching.md) - Web domain and Android package name matching for autofill credential lookup.
