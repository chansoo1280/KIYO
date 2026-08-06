import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';

test('debug Zustand store via debug API', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await clearIndexedDB(page);
  await page.evaluate(() => localStorage.clear());

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
  
  // 8. Debug API로 Zustand store 상태 확인
  const sessionState = await page.evaluate(() => {
    return (window as any).__KIYO_DEBUG__?.getSession?.() ?? { error: 'debug api not found' };
  });
  
  console.log('=== STATE AFTER CREATE FILE (via debug API) ===');
  console.log(JSON.stringify(sessionState, null, 2));
  
  await page.waitForTimeout(5000);
});