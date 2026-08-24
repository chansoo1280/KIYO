import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';
import { HomePage, AccountListPage } from './pages/HomePage';

test.describe('수동 잠금 / 자동 잠금 (Manual Lock / Auto Lock)', () => {
  let homePage: HomePage;
  let accountListPage: AccountListPage;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());

    homePage = new HomePage(page);
    accountListPage = new AccountListPage(page);
  });

  test.describe('수동 잠금 (Manual Lock)', () => {
    test('페이지 새로고침으로 잠금 유도 → 인증 페이지(/auth)로 이동 → PIN 입력 후 다시 진입 가능', async ({ page }) => {
      // 1. 암호화 볼트 생성
      await homePage.createFile('test-manual-lock', true, TEST_PIN);
      await page.waitForLoadState('networkidle');

      // 2. 페이지 새로고침 (cryptoKey는 메모리에만 있으므로 새로고침 시 상실 → 잠금)
      await page.reload();
      await page.waitForLoadState('networkidle');

      // 3. 인증 페이지(/auth)로 리다이렉트 확인
      await page.waitForURL('**/auth', { timeout: 10000 });
      await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('PIN 번호', { exact: true })).toBeVisible();

      // 4. 올바른 PIN 입력
      await page.fill('input[type="password"]', TEST_PIN);
      await page.getByRole('button', { name: '확인' }).click();

      // 5. 홈 화면(/accounts) 진입 확인
      await page.waitForURL('**/accounts', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 6. 계정 리스트 페이지 확인
      const accountListContainer = page.locator('section.min-h-svh').first();
      await expect(accountListContainer).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('자동 잠금 (Auto Lock)', () => {
    test('자동 잠금 "미사용" 설정 시 페이지 비활성화해도 잠금되지 않음', async ({ page }) => {
      // 1. 암호화 볼트 생성
      await homePage.createFile('test-auto-lock-none', true, TEST_PIN);
      await page.waitForLoadState('networkidle');

      // 2. 설정 → 자동 잠금 "미사용" 설정
      await accountListPage.clickSettings();
      await page.waitForLoadState('networkidle');

      const autoLockSelect = page.locator('select[aria-label="자동잠금 시간 선택"]');
      await expect(autoLockSelect).toBeVisible({ timeout: 5000 });
      await autoLockSelect.selectOption('none');

      // 설정 저장 확인 메시지 대기
      await expect(page.locator('text=자동잠금이 비활성화되었습니다.')).toBeVisible({ timeout: 5000 });

      // 3. 홈으로 돌아가기
      const listTab = page.locator('button[aria-label="List"], button:has-text("📋")').first();
      await listTab.click();
      await page.waitForURL('**/accounts', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 4. 앱 비활성화 시뮬레이션
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // 5. 잠시 대기 후 다시 활성화
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // 6. 여전히 리스트 페이지에 있어야 함 (자동 잠금 비활성화)
      await expect(page).toHaveURL(/\/accounts/);
    });
  });
});