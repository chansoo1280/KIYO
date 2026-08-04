import { test as base, type Page } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FixtureContext = any;

/**
 * IndexedDB 완전 초기화 헬퍼
 * 
 * 주의: 앱 로드 후(페이지 네비게이션 후) 호출해야 함.
 * Vite/React 초기화 과정에서 DB connection을 먼저 잡을 수 있으므로
 * 페이지가 완전히 로드된 시점에서 정리하는 것이 안전.
 */
export async function clearIndexedDB(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();

    await Promise.all(
      databases.map(db =>
        new Promise<void>(resolve => {
          if (!db.name) {
            resolve();
            return;
          }
          const request = indexedDB.deleteDatabase(db.name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve(); // 에러 무시 (이미 삭제된 경우 등)
        })
      )
    );
  });
}

/**
 * IndexedDB 격리 픽스처 (선택적 사용)
 * - 각 테스트에서 명시적으로 호출하여 사용
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }: FixtureContext, fn: (page: Page) => Promise<void>) => {
    await fn(page);
  },
});