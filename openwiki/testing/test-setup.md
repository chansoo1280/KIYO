---
type: reference
title: Test Setup
description: Vitest setups (common, unit, integration) with mocks for Capacitor plugins, KiyoAutofill, Dexie table modules, and fake-indexeddb.
tags: [testing, vitest, setup, mocks, fake-indexeddb]
---

# Test Setup

The Vitest configuration lives in `vitest.config.ts`. The frontend has three setup files:

- `src/test/common.setup.ts` — mocks for Capacitor plugins + `KiyoAutofill` web fallback; imported by `unit.setup.ts` and `integration.setup.ts`.
- `src/test/unit.setup.ts` — additionally mocks `accountTable`/`templateTable`/`fileTable` so unit tests don't touch Dexie.
- `src/test/integration.setup.ts` — extends `common.setup.ts` with `fake-indexeddb` so integration tests can use Dexie normally.

## common.setup.ts

```typescript
import { vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "web", isNativePlatform: () => false },
}));

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { /* minimal stub */ },
  Directory: { Documents: "DOCUMENTS" },
  Encoding: { UTF8: "utf8" },
}));

vi.mock("@/plugins/kiyautofill", () => ({
  KiyoAutofill: {
    isAutofillEnabled: vi.fn().mockResolvedValue({ enabled: false, isOurService: false }),
    syncAccountsFromReact: vi.fn().mockResolvedValue({ success: true, syncedCount: 0, errorCount: 0 }),
    openAutofillSettings: vi.fn().mockResolvedValue({ success: true }),
  },
}));
```

This makes every web test run as if it were on the web platform, so `Capacitor.getPlatform() !== "android"` short-circuits the autofill sync path.

## unit.setup.ts

```typescript
import "@/test/common.setup";

vi.mock("@/database/accountTable", () => ({
  accountTable: { /* full mock */ },
}));
vi.mock("@/database/templateTable", () => ({
  templateTable: { /* full mock */ },
}));
vi.mock("@/database/fileTable", () => ({
  fileTable: { /* full mock */ },
}));
```

This isolates pure-logic tests from the persistence layer so they can run in a few ms.

## integration.setup.ts

```typescript
import "@/test/common.setup";
import "fake-indexeddb/auto";
```

Integration tests use the real table modules against `fake-indexeddb` (in-memory IDB). The `setupFiles` reference in `vitest.config.ts` is:

```typescript
test: {
  environment: "jsdom",
  setupFiles: ["./src/test/integration.setup.ts"],
}
```

For unit-only runs, `npm run test` uses the same integration setup; pure-unit tests typically mock the table modules locally rather than relying on the setup file.

## Test Helpers

- `src/test/fixtures/` — `accountFixtures.ts`, `templateFixtures.ts`, `databaseFixtures.ts` — reusable Account/Template/KiyoVaultData builders.
- `src/test/helpers/` and `src/test/mocks/` — reserved for future helpers; currently empty.

## Source Anchors

- `common.setup.ts` — `/src/test/common.setup.ts`
- `unit.setup.ts` — `/src/test/unit.setup.ts`
- `integration.setup.ts` — `/src/test/integration.setup.ts`
- `fixtures/` — `/src/test/fixtures/`
- `vitest.config.ts` — `/vitest.config.ts`