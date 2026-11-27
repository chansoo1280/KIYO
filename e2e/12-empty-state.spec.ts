import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { createVault } from './utils/vault-creation';

test.describe('AccountList Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());
  });

  test('계정이 없을 때 "계정이 없습니다." 안내와 "계정 추가" 버튼 표시', async ({
    page,
  }) => {
    // 암호화 볼트 생성 후 /accounts 도달 (빈 계정 상태 보장)
    await createVault(page);

    await expect(page.getByText('계정이 없습니다.')).toBeVisible();
    await expect(page.getByRole('button', { name: /계정 추가/ })).toBeVisible();
  });

  test('계정 추가 버튼 클릭 시 템플릿 피커가 열림', async ({ page }) => {
    await createVault(page);

    await expect(page.getByText('계정이 없습니다.')).toBeVisible();
    await page.getByRole('button', { name: /계정 추가/ }).click();
    await expect(page.getByText('템플릿 선택')).toBeVisible();
  });

  test('검색 결과가 없을 때 "검색 결과가 없습니다." 안내 표시', async ({
    page,
  }) => {
    await createVault(page);

    await expect(page.getByText('계정이 없습니다.')).toBeVisible();

    // 검색 버튼 클릭 → 검색 입력 표시
    await page.getByRole('button', { name: /Search/ }).click();
    const searchInput = page.getByPlaceholder(/제목이나 이메일로 검색/);
    await searchInput.fill('존재하지않는사이트');

    await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible();
  });
});
