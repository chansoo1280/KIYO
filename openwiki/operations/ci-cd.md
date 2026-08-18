---
type: detail
title: CI/CD Pipeline
description: GitHub Actions workflow for continuous integration including typecheck, lint, test, and build.
tags: [operations, ci-cd, github-actions]
---

# CI/CD Pipeline

KIYO uses GitHub Actions for continuous integration. The workflow runs on every push and pull request to main branches.

## Workflow File

- **Location**: `/.github/workflows/ci.yml`

## Trigger Events

- Push to branches: `main`, `develop`, `v2`
- Pull requests to branches: `main`, `develop`, `v2`

## Jobs

### Test Job

Runs on `ubuntu-latest` with Node.js 22 and npm caching.

| Step | Command | Purpose |
|------|---------|---------|
| Checkout | `actions/checkout@v4` | Clone repository |
| Setup Node.js | `actions/setup-node@v4` | Install Node.js 22 with npm cache |
| Install dependencies | `npm ci` | Clean install of exact package versions |
| Type checking | `npm run typecheck` | Run TypeScript compiler validation |
| Linting | `npm run lint` | Run ESLint for code quality |
| Tests | `npm run test` | Run Vitest unit/integration tests |
| Build | `npm run build` | Vite production build |

## Commands Reference

| Command | Description |
|---------|-------------|
| `npm run typecheck` | TypeScript compiler check (`tsc --noEmit`) |
| `npm run lint` | ESLint check (`eslint .`) |
| `npm run test` | Vitest test runner |
| `npm run build` | Vite production build to `/dist` |

## Local Development

Run CI checks locally before pushing:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

## Branch Protection

Configure branch protection rules in GitHub to require:
- Status checks to pass (CI workflow)
- PR reviews before merge
- Up-to-date branches before merge

---

*Added based on commit 0adb420e*