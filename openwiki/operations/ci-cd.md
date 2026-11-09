---
type: reference
title: CI/CD
description: GitHub Actions workflows — ci.yml (lint, typecheck, test, build) and openwiki-update.yml (wiki sync).
tags: [operations, ci, github-actions, openwiki]
---

# CI/CD

KIYO uses two GitHub Actions workflows under `.github/workflows/`.

## ci.yml — Continuous Integration

**Triggers**: `push` to `main`/`develop`/`v2` and `pull_request` to those branches.

**Steps**:
1. `actions/checkout@v5`
2. `actions/setup-node@v5` (Node 22)
3. `npm ci`
5. `npm run typecheck`
6. `npm run lint`
7. `npm run test`
8. `npm run build`

The `test` step also runs Android Robolectric/JUnit tests on Ubuntu. The `android` build steps are not part of `ci.yml` (they require macOS for full SDK); instead, they run on developer machines via `npm run android:build`.

## openwiki-update.yml — Wiki Sync Automation

**Triggers**: `workflow_dispatch` (manual run only).

**Steps**:
1. Checkout with `fetch-depth: 0` (full history so `openwiki code --update` can diff HEAD against the last documented commit).
2. Install OpenWiki (`npm install --global openwiki@0.3.3` + mermaid + jsdom).
3. Run `openwiki code --update --print` with the configured `OPENWIKI_PROVIDER=nvidia` + `NVIDIA_API_KEY` + `OPENWIKI_MODEL_ID`.
4. `peter-evans/create-pull-request@v7` opens a PR with the wiki updates.

This is the workflow that regenerates `/openwiki/` on demand. The scheduled cron (`0 8 * * *`) is commented out to keep the workflow manual.

## Source Anchors

- `ci.yml` — `/.github/workflows/ci.yml`
- `openwiki-update.yml` — `/.github/workflows/openwiki-update.yml`