import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN, WRONG_PIN } from './fixtures/test-data';

test.describe('PIN 언락 (PIN Unlock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('올바른 PIN으로 기존 볼트 잠금 해제 후 홈 화면(/accounts) 진입', async ({ page }) => {
    // 1. 사전 준비: 암호화 볼트 생성
    await page.getByRole('button', { name: '파일 생성' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill('test-unlock-vault');

    const encryptedCheckbox = page.getByRole('dialog').locator('input[type="checkbox"]');
    await expect(encryptedCheckbox).toBeChecked();

    const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
    await expect(pinInput).toBeVisible();
    await pinInput.fill(TEST_PIN);

    await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

    // 최초 생성 시 바로 /accounts 이동
    await page.waitForURL('**/accounts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 2. 페이지 새로고침하여 잠금 상태 유도 (cryptoKey는 persist 안 됨)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 3. /auth로 리다이렉트되어야 함
    await page.waitForURL('**/auth', { timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('PIN 번호', { exact: true })).toBeVisible();

    // 4. 올바른 PIN 입력
    await page.fill('input[type="password"]', TEST_PIN);
    await page.getByRole('button', { name: '확인' }).click();

    // 5. 홈 화면(/accounts) 진입 확인
    await page.waitForURL('**/accounts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 6. 계정 리스트 페이지 확인 (빈 리스트)
    const accountListContainer = page.locator('section.min-h-svh').first();
    await expect(accountListContainer).toBeVisible({ timeout: 5000 });
    const accountItems = page.locator('article[role="button"]');
    await expect(await accountItems.count()).toBe(0);
  });

  test('잘못된 PIN 입력 시 에러 메시지 표시 및 잠금 상태 유지', async ({ page }) => {
    // 1. 사전 준비: 암호화 볼트 생성 및 잠금 유도
    await page.getByRole('button', { name: '파일 생성' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill('test-wrong-pin-vault');

    const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
    await expect(pinInput).toBeVisible();
    await pinInput.fill(TEST_PIN);

    await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

    await page.waitForURL('**/accounts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 새로고침으로 잠금 상태 유도
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForURL('**/auth', { timeout: 10000 });

    // 2. 잘못된 PIN 입력
    await page.fill('input[type="password"]', WRONG_PIN);
    await page.getByRole('button', { name: '확인' }).click();

    // 3. 에러 메시지 표시 확인 ("PIN이 일치하지 않습니다" 또는 유사)
    await expect(page.locator('[role="alert"]').filter({ hasText: 'PIN 불일치' })).toBeVisible({ timeout: 5000 });

    // 4. 여전히 인증 페이지(/auth)에 머물러 있어야 함
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('PIN 입력 없이 확인 버튼 클릭 시 에러 메시지', async ({ page }) => {
    // 1. 사전 준비: 암호화 볼트 생성 및 잠금 유도
    await page.getByRole('button', { name: '파일 생성' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill('test-empty-pin-vault');

    const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
    await expect(pinInput).toBeVisible();
    await pinInput.fill(TEST_PIN);

    await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

    await page.waitForURL('**/accounts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForURL('**/auth', { timeout: 10000 });

    // 2. PIN 입력하지 않고 확인 버튼 클릭
    await page.getByRole('button', { name: '확인' }).click();

    // 3. 에러 메시지 표시 확인
    await expect(page.locator('[role="alert"]').filter({ hasText: '핀번호를 입력하세요' })).toBeVisible({ timeout: 5000 });

    // 4. 여전히 인증 페이지에 머물러 있어야 함
    await expect(page).toHaveURL(/\/auth/);
  });

  test('비암호화 볼트는 새로고침 후 바로 /accounts 접근 가능 (PIN 불필요)', async ({ page }) => {
    // 1. 비암호화 볼트 생성
    await page.getByRole('button', { name: '파일 생성' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill('test-unencrypted-unlock-vault');

    const encryptedCheckbox = page.getByRole('dialog').locator('input[type="checkbox"]');
    await expect(encryptedCheckbox).toBeChecked();
    await encryptedCheckbox.uncheck();

    // PIN 입력 필드가 사라져야 함
    await expect(page.getByRole('dialog').locator('input[type="password"]')).not.toBeVisible({ timeout: 5000 });

    await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

    // 2. 바로 /accounts 이동 확인
    await page.waitForURL('**/accounts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 3. 새로고침 후에도 /accounts 유지 (인증 불필요)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/accounts/);

    // 4. 계정 리스트 페이지 확인
    const accountListContainer = page.locator('section.min-h-svh').first();
    await expect(accountListContainer).toBeVisible({ timeout: 5000 });
  });
});