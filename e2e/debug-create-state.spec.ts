import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';

test('debug state after createFile', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await clearIndexedDB(page);
  await page.evaluate(() => localStorage.clear());

  // 콘솔 로그 캡처
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  // 1. 파일 생성 다이얼로그 열기
  await expect(page.getByRole('button', { name: '파일 생성' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: '파일 생성' }).click();
  
  // 2. 다이얼로그 확인
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('heading', { name: '새 파일 생성' })).toBeVisible();
  
  // 3. 파일 이름 입력
  const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
  await expect(fileNameInput).toBeVisible();
  await fileNameInput.fill('test-vault');
  
  // 4. 암호화 체크박스 확인
  const encryptedCheckbox = page.getByRole('dialog').locator('input[type="checkbox"]');
  await expect(encryptedCheckbox).toBeChecked();
  
  // 5. PIN 입력
  const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
  await expect(pinInput).toBeVisible();
  await pinInput.fill(TEST_PIN);
  
  // 6. 생성 버튼 클릭
  await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();
  
  // 7. /list 이동 대기
  await page.waitForURL('**/list', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  
  // 8. localStorage에서 세션 확인
  const sessionState = await page.evaluate(() => {
    try {
      const stored = localStorage.getItem('kiyo-session');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  console.log('=== localStorage session ===');
  console.log(JSON.stringify(sessionState, null, 2));
  
  // 9. IndexedDB에서 파일 정보 확인
  const fileInfo = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('kiyo-db');
      request.onsuccess = (event) => {
        const db = event.target.result;
        try {
          const transaction = db.transaction(['files'], 'readonly');
          const store = transaction.objectStore('files');
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            const files = getAllRequest.result;
            const active = files.find(f => f.isActive) || files[0];
            resolve(active ? { 
              activeFileName: active.fileName, 
              encrypted: active.encrypted,
              isActive: active.isActive 
            } : { activeFileName: null, encrypted: false, isActive: false });
          };
          getAllRequest.onerror = () => resolve({ activeFileName: null, encrypted: false, isActive: false });
        } catch (e) {
          resolve({ activeFileName: null, encrypted: false, isActive: false });
        }
      };
      request.onerror = () => resolve({ activeFileName: null, encrypted: false, isActive: false });
    });
  });
  
  console.log('=== IndexedDB file info ===');
  console.log(JSON.stringify(fileInfo, null, 2));
  
  // 10. sessionStore의 cryptoKey 확인 (Zustand store 직접 접근)
  const storeState = await page.evaluate(() => {
    // @ts-ignore
    if (window.__ZUSTAND_DEVTOOLS__) {
      // @ts-ignore
      return window.__ZUSTAND_DEVTOOLS__.getState?.();
    }
    return null;
  });
  
  console.log('=== Zustand store state ===');
  console.log(JSON.stringify(storeState, null, 2));
  
  await page.waitForTimeout(5000);
});