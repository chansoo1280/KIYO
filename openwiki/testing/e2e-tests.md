---
type: reference
title: E2E Tests (Web / Playwright)
description: Playwright config and web E2E specs that exercise the React UI via headless Chromium against the Vite dev server.
tags: [testing, e2e, playwright, web]
---

# E2E Tests (Web / Playwright)

Playwright is configured in `/playwright.config.ts` and runs against `npm run dev` (Vite dev server).

## Configuration

```typescript
// playwright.config.ts (abridged)
export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:5173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

## Specs

The `e2e/` directory holds specs. Example flow:

1. Navigate to `/`.
2. Click "Create vault" → fill name → enter PIN → confirm.
3. Verify `/auth` then `/accounts` after unlock.
4. Add account, edit, delete.
5. Lock vault → confirm `/auth` again.

## Commands

```bash
npm run test:e2e           # headless
npm run test:e2e:ui        # UI mode
npm run test:e2e:headed    # headed mode
npm run test:e2e:debug     # debug mode
```

## Source Anchors

- `playwright.config.ts` — `/playwright.config.ts`
- `e2e/` — `/e2e/`