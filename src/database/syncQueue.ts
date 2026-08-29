import { persistVaultSnapshot, type SyncDatabaseParams } from "./db";

type ParamsGetter = () => SyncDatabaseParams;
type Task = { getParams: ParamsGetter; resolve: () => void };

const queue: Task[] = [];
let processing = false;

export function enqueuePersistVaultSnapshot(getParams: ParamsGetter): Promise<void> {
  return new Promise((resolve) => {
    queue.push({ getParams, resolve });
    processQueue();
  });
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { getParams, resolve } = queue.shift()!;
    try {
      const params = getParams();  // 실행 시점에 최신 세션 읽기
      await persistVaultSnapshot(params);
      resolve();
    } catch (e) {
      // 에러 로깅 후 다음 작업 계속 진행 (기존 동작 유지)
      console.error("[syncQueue] persist failed, continuing:", e);
      resolve();  // reject하지 않고 resolve로 다음 작업 진행
    }
  }
  processing = false;
}

// 테스트용 헬퍼
export function waitForQueueDrain(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (queue.length === 0 && !processing ? resolve() : setTimeout(check, 10));
    check();
  });
}

// 디버깅용: 큐 상태 확인
export function getQueueLength(): number {
  return queue.length;
}

export function isQueueProcessing(): boolean {
  return processing;
}