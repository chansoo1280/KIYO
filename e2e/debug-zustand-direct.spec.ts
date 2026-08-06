import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';

test('debug Zustand store cryptoKey', async ({ page }) => {
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
  
  // 8. Zustand store에 직접 접근하기 위해 window에 노출
  const storeState = await page.evaluate(() => {
    // React 앱에서 useSessionStore 훅이 사용된 컴포넌트 찾기
    // 또는 모듈 캐시에서 store 추출 시도
    const results: any = {};
    
    // 1. window.__ZUSTAND_DEVTOOLS__ 확인
    if ((window as any).__ZUSTAND_DEVTOOLS__) {
      try {
        const state = (window as any).__ZUSTAND_DEVTOOLS__.getState?.();
        results.devtools = state ? { 
          cryptoKey: !!state.cryptoKey,
          activeFileName: state.activeFileName,
          keys: Object.keys(state)
        } : 'getState failed';
      } catch (e) {
        results.devtoolsError = e.message;
      }
    } else {
      results.devtools = 'not found';
    }
    
    // 2. 모든 window 속성에서 zustand/store 관련 찾기
    const zustandKeys: string[] = [];
    for (const key of Object.keys(window)) {
      if (key.toLowerCase().includes('zustand') || 
          key.toLowerCase().includes('session') ||
          key.toLowerCase().includes('store')) {
        zustandKeys.push(key);
      }
    }
    results.windowKeys = zustandKeys;
    
    // 3. module 캐시 확인 (vite dev server에서)
    // @ts-ignore
    if (window.__vite_module_cache__) {
      results.viteCache = 'exists';
    }
    
    // 4. React devtools 확인
    // @ts-ignore
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      results.reactDevtools = 'exists';
    }
    
    return results;
  });
  
  console.log('=== WINDOW STORE INFO ===');
  console.log(JSON.stringify(storeState, null, 2));
  
  // 9. localStorage 확인
  const localSession = await page.evaluate(() => {
    const stored = localStorage.getItem('kiyo-session');
    return stored ? JSON.parse(stored) : null;
  });
  
  console.log('=== LOCALSTORAGE ===');
  console.log(JSON.stringify(localSession, null, 2));
  
  await page.waitForTimeout(5000);
});