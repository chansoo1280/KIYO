import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';
import { HomePage, AccountListPage } from './pages/HomePage';
import { TemplateListPage, TemplateEditPage } from './pages/TemplatePages';

test('debug template to list navigation', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await clearIndexedDB(page);
  await page.evaluate(() => localStorage.clear());

  const homePage = new HomePage(page);
  const accountListPage = new AccountListPage(page);
  const templateListPage = new TemplateListPage(page);
  const templateEditPage = new TemplateEditPage(page);

  // 1. 볼트 생성
  await homePage.createFile('test-debug', true, TEST_PIN);
  
  // 2. 설정 -> 템플릿 관리
  await accountListPage.clickSettings();
  await templateListPage.goto();
  await templateListPage.createTemplate();
  await templateEditPage.setName('테스트');
  await templateEditPage.updateField(0, { label: '필드1', type: 'text' });
  await templateEditPage.save();
  
  // 템플릿 저장 후 /templates에 있음
  console.log('After template save - URL:', page.url());
  
  // AccountListPage.goto() 호출 (bottom tab 사용)
  await accountListPage.goto();
  
  console.log('After accountListPage.goto() - URL:', page.url());
  
  // AccountList의 useEffect에서 어떤 상태인지 확인
  const debugInfo = await page.evaluate(async () => {
    // Zustand store 직접 확인
    // @ts-ignore
    const zustandState = window.__ZUSTAND_DEVTOOLS__?.getState?.() ?? null;
    
    // localStorage session
    const localSession = localStorage.getItem('kiyo-session');
    const parsed = localSession ? JSON.parse(localSession) : null;
    
    // sessionStore의 getState 직접 호출 (가능한 경우)
    let sessionState = null;
    try {
      const { useSessionStore } = await import('@/store/sessionStore');
      sessionState = useSessionStore.getState();
    } catch (e) {
      sessionState = { error: e.message };
    }
    
    // IndexedDB active file
    const fileInfo = await new Promise((resolve) => {
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
    
    return {
      zustandState,
      localStorageSession: parsed,
      sessionStoreState: sessionState,
      indexedDB: fileInfo,
    };
  });
  
  console.log('=== NAVIGATION DEBUG INFO ===');
  console.log(JSON.stringify(debugInfo, null, 2));
  
  await page.waitForTimeout(5000);
});