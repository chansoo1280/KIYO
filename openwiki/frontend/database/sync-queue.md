---
type: reference
title: Sync Queue
description: Auto-save serialization queue with coalescing, drain helper, and debug surface.
tags: [database, sync-queue, auto-save, concurrency]
---

# Sync Queue

`/src/database/syncQueue.ts` serializes auto-save writes across the React side. Every store mutation that affects persisted vault state (`accountStore._persistAccounts`, `templateStore._persistTemplates`, and indirectly `sessionStore.clearSession` via `closeDataFile`) calls `enqueuePersistVaultSnapshot`.

## API

```typescript
type ParamsGetter = () => SyncDatabaseParams;
type Task = { getParams: ParamsGetter; resolve: () => void };

const queue: Task[] = [];
let processing = false;

export function enqueuePersistVaultSnapshot(getParams: ParamsGetter): Promise<void>
export function waitForQueueDrain(): Promise<void>
export function getQueueLength(): number
export function isQueueProcessing(): boolean
```

## Contract

| Property | Implementation |
|----------|---------------|
| Serialization | `processing` guard ensures one snapshot at a time. |
| Coalescing | `getParams()` is invoked at execution time, so the latest session state is read (not the state at enqueue time). |
| Failure handling | On `persistVaultSnapshot` error, the task resolves (not rejects) and the queue continues to the next task. Auto-save is best-effort. |
| Drain helper | `waitForQueueDrain` polls `queue.length === 0 && !processing` every 10ms. |
| Debug surface | `getQueueLength` and `isQueueProcessing` exposed on `window.__KIYO_DEBUG__` in dev mode. |

## Source Anchors

- `syncQueue.ts` — `/src/database/syncQueue.ts`
- Callers — `/src/store/accountStore.ts::_persistAccounts`, `/src/store/templateStore.ts`