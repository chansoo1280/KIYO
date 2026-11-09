---
type: page
title: CreateVaultPage
description: Multi-step wizard to create a new vault file (NameStep + PinStep with Stepper).
tags: [page, create-vault, wizard, vault-create]
---
# CreateVaultPage
Source File: /src/pages/CreateVault/index.tsx
Route: /create-vault
Responsibility
Multi-step wizard that collects a vault name and (optionally) a PIN, then calls fileStorage.createDataFile.
Steps
- NameStep (/src/pages/CreateVault/steps/NameStep.tsx) - validates name (non-empty, no `/`, length limit), ensures uniqueness via fileTable.resolveFileName ((N) suffix dedup).
- PinStep (/src/pages/CreateVault/steps/PinStep.tsx) - PIN entry + confirmation + strength meter (PinStrengthMeter).
- Stepper (/src/pages/CreateVault/components/Stepper.tsx) - visual indicator of progress.
Submit
Calls fileStorage.createDataFile({ fileName, pin }). On success, navigate to /accounts.
Focused Tests
- src/pages/CreateVault/CreateVaultPage.test.tsx covers name validation, PIN mismatch, PIN too short, name collision dedup.
Source Anchors
- Page: /src/pages/CreateVault/index.tsx
- Name step: /src/pages/CreateVault/steps/NameStep.tsx
- Pin step: /src/pages/CreateVault/steps/PinStep.tsx
- Stepper: /src/pages/CreateVault/components/Stepper.tsx
- File table: /src/database/fileTable.ts (resolveFileName)