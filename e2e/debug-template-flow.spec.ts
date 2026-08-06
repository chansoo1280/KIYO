import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';
import { HomePage, AccountListPage } from './pages/HomePage';
import { TemplateListPage, TemplateEditPage } from './pages/TemplatePages';

test('debug cryptoKey after template flow', async ({ page }) => {
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
  
  // 2. 생성 직후 cryptoKey 확인
  let sessionState = await page.evaluate(() => {
    return (window as any).__KIYO_DEBUG__?.getSession?.() ?? { error: 'debug api not found' };
  });
  console.log('=== AFTER CREATE FILE ===');
  console.log(JSON.stringify(sessionState, null, 2));
  
  // 3. 설정 -> 템플릿 관리
  await accountListPage.clickSettings();
  await templateListPage.goto();
  await templateListPage.createTemplate();
  await templateEditPage.setName('테스트');
  await templateEditPage.updateField(0, { label: '필드1', type: 'text' });
  await templateEditPage.save();
  
  // 4. 템플릿 저장 후 /templates에 있음
  console.log('After template save - URL:', page.url());
  sessionState = await page.evaluate(() => {
    return (window as any).__KIYO_DEBUG__?.getSession?.() ?? { error: 'debug api not found' };
  });
  console.log('=== AFTER TEMPLATE SAVE (/templates) ===');
  console.log(JSON.stringify(sessionState, null, 2));
  
  // 5. goBack() 사용 (bottom tab 대신)
  await page.goto('/list');
  await page.waitForURL('**/list');
  
  console.log('After goto /list - URL:', page.url());
  sessionState = await page.evaluate(() => {
    return (window as any).__KIYO_DEBUG__?.getSession?.() ?? { error: 'debug api not found' };
  });
  console.log('=== AFTER GO BACK TO LIST ===');
  console.log(JSON.stringify(sessionState, null, 2));
  
  await page.waitForTimeout(5000);
});