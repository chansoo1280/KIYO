import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN, WRONG_PIN } from './fixtures/test-data';
import { createVault } from './utils/vault-creation';

test.describe('PIN 언락 (PIN Unlock)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('올바른 PIN으로 기존 볼트 잠금 해제 후 홈 화면(/accounts) 진입', async ({ page }) => {
    // 1. 사전 준비: 암호화 볼트 생성 (Plan-7a: 페이지 기반)
    await createVault(page, { fileName: 'test-unlock-vault' });

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
    await createVault(page, { fileName: 'test-wrong-pin-vault' });

    // 새로고침으로 잠금 상태 유도
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForURL('**/auth', { timeout: 10000 });

    // 2. 잘못된 PIN 입력
    await page.fill('input[type="password"]', WRONG_PIN);
    await page.getByRole('button', { name: '확인' }).click();

    // 3. 에러 메시지 표시 확인
    await expect(page.locator('[role="alert"]').filter({ hasText: 'PIN 불일치' })).toBeVisible({ timeout: 5000 });

    // 4. 여전히 인증 페이지(/auth)에 머물러 있어야 함
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('PIN 입력 없이 확인 버튼 클릭 시 에러 메시지', async ({ page }) => {
    // 1. 사전 준비: 암호화 볼트 생성 및 잠금 유도
    await createVault(page, { fileName: 'test-empty-pin-vault' });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForURL('**/auth', { timeout: 10000 });

    // 2. PIN 입력하지 않고 확인 버튼 클릭
    await page.getByRole('button', { name: '확인' }).click();

    // 3. 에러 메시지 표시 확인 (Plan-4: "PIN은 4자 이상 입력해주세요.")
    await expect(page.locator('[role="alert"]').filter({ hasText: 'PIN은 4자 이상 입력해주세요.' })).toBeVisible({ timeout: 5000 });

    // 4. 여전히 인증 페이지에 머물러 있어야 함
    await expect(page).toHaveURL(/\/auth/);
  });

  // Plan-7a: PIN 건너뛰기 옵션으로 비암호화 볼트 생성 가능 (체크박스 제거 보강)
  test('비암호화 볼트는 새로고침 후 바로 /accounts 접근 가능 (PIN 불필요)', async ({ page }) => {
    // 1. 비암호화 볼트 생성 (Plan-7a: encrypted=false 옵션)
    await createVault(page, {
      fileName: 'test-unencrypted-unlock-vault',
      encrypted: false,
    });

    // 2. 바로 /accounts 이동 확인
    await expect(page).toHaveURL(/\/accounts/);

    // 3. 새로고침 후에도 /accounts 유지 (인증 불필요)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/accounts/);

    // 4. 계정 리스트 페이지 확인
    const accountListContainer = page.locator('section.min-h-svh').first();
    await expect(accountListContainer).toBeVisible({ timeout: 5000 });
  });
});
