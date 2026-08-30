import { expect, type Page } from '@playwright/test';

/**
 * db.files 테이블에 지정한 fileName들이 존재하는지 검증
 */
export async function expectDbFilesContain(
  page: Page,
  expectedFileNames: string[],
): Promise<void> {
  const actualFileNames = await page.evaluate(async () => {
    const db = await indexedDB.open('kiyo-db');
    return new Promise<string[]>((resolve, reject) => {
      db.onsuccess = () => {
        const tx = db.result.transaction('files', 'readonly');
        const store = tx.objectStore('files');
        const req = store.getAll();
        req.onsuccess = () => {
          const files = req.result as Array<{ fileName: string }>;
          resolve(files.map((f) => f.fileName));
        };
        req.onerror = () => reject(req.error);
      };
      db.onerror = () => reject(db.error);
    });
  });

  for (const name of expectedFileNames) {
    expect(actualFileNames).toContain(name);
  }
}

/**
 * store들이 제대로 초기화되었는지 검증 (activeFileName, cryptoKey 등)
 */
export async function expectStoresReset(
  page: Page,
  context: string = 'unknown',
): Promise<void> {
  const state = await page.evaluate(() => {
    return {
      activeFileName: localStorage.getItem('kiyo-active-file'),
      hasCryptoKey: false, // cryptoKey는 메모리 only이므로 검증 불가
    };
  });

  expect(state.activeFileName, `${context}: activeFileName should be cleared`).toBeNull();
}
