import { test, expect, type Page } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';
import { createVault } from './utils/vault-creation';
import { expectDbFilesContain, expectStoresReset } from './utils/db-helpers';

/**
 * Plan-7a: 모든 "파일 생성" 시나리오는 createVault() 공통 유틸 사용
 */

test.describe('closeDataFile (multi-vault: 이전 vault 행 보존)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());
  });

  test.describe('Auth 페이지 - "첫 화면으로 돌아가기" 버튼', () => {
    test('암호화 볼트 생성 → 언락 후 → "첫 화면으로 돌아가기" 클릭 시 Home으로 이동하고 파일 선택 다이얼로그 표시', async ({ page }) => {
      // 1. 암호화 볼트 생성
      await createVault(page, { fileName: 'test-back-to-home' });

      // 2. 새로고침으로 잠금 유도 (/auth로 리다이렉트)
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForURL('**/auth', { timeout: 10000 });
      await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('PIN 번호', { exact: true })).toBeVisible();

      // 3. "첫 화면으로 돌아가기" 버튼 클릭
      const backButton = page.getByRole('button', { name: '첫 화면으로 돌아가기' });
      await expect(backButton).toBeVisible({ timeout: 5000 });
      await backButton.click();

      // 4. Home 페이지(/)로 이동 — 이전 vault는 db.files에 보존되어 리스트에 보임
      await page.waitForURL('/', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('파일을 선택하세요', { exact: true })).toBeVisible({ timeout: 5000 });

      // multi-vault: db.files에 이전 vault 행 보존
      await expectDbFilesContain(page, ['test-back-to-home.json']);

      // multi-vault: Home 리스트에 이전 vault 표시
      await expect(page.getByTestId('file-list-item')).toHaveCount(1);
      await expect(page.getByText('test-back-to-home.json')).toBeVisible();

      // 5. 스토어들이 제대로 초기화되었는지 검증
      await expectStoresReset(page, 'Auth - 첫 화면으로 돌아가기 후');
    });
  });

  test.describe('Settings 페이지 - "파일변경" 버튼', () => {
    test('암호화 볼트 생성 → Settings 진입 → "파일변경" 클릭 시 Home으로 이동하고 파일 선택 화면 표시', async ({ page }) => {
      // 1. 암호화 볼트 생성
      await createVault(page, { fileName: 'test-settings-file-change' });

      // 2. Settings 페이지로 이동
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.waitForURL('**/settings', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 3. "파일변경" 버튼 클릭
      const fileChangeRow = page.locator('text=파일변경').locator('..');
      await expect(fileChangeRow.locator('button:has-text("이동")')).toBeVisible({ timeout: 5000 });
      await fileChangeRow.locator('button:has-text("이동")').click();

      // 4. Home 페이지로 이동
      await page.waitForURL('/', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('파일을 선택하세요', { exact: true })).toBeVisible({ timeout: 5000 });

      // multi-vault: 이전 vault 행 보존 + 리스트 표시
      await expectDbFilesContain(page, ['test-settings-file-change.json']);
      await expect(page.getByTestId('file-list-item')).toHaveCount(1);
      await expect(page.getByText('test-settings-file-change.json')).toBeVisible();

      // 5. 스토어 초기화 검증
      await expectStoresReset(page, 'Settings - 파일변경 후 (암호화 볼트)');
    });

    test('비암호화 볼트에서도 Settings → "파일변경" 동작 확인', async ({ page }) => {
      // 1. 비암호화 볼트 생성 (Plan-7a: encrypted=false)
      await createVault(page, {
        fileName: 'test-unencrypted-file-change',
        encrypted: false,
      });

      // 2. Settings → 파일변경
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.waitForURL('**/settings', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      const fileChangeRow = page.locator('text=파일변경').locator('..');
      await expect(fileChangeRow.locator('button:has-text("이동")')).toBeVisible({ timeout: 5000 });
      await fileChangeRow.locator('button:has-text("이동")').click();

      // 3. Home으로 이동
      await page.waitForURL('/', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('파일을 선택하세요', { exact: true })).toBeVisible({ timeout: 5000 });

      // multi-vault: 이전 vault 행 보존
      await expectDbFilesContain(page, ['test-unencrypted-file-change.json']);
      await expect(page.getByTestId('file-list-item')).toHaveCount(1);

      // 4. 스토어 초기화
      await expectStoresReset(page, 'Settings - 파일변경 후 (비암호화 볼트)');
    });
  });

  test.describe('closeDataFile 호출 후 multi-vault lifecycle', () => {
    test('Auth에서 "첫 화면으로 돌아가기" 후 다시 볼트 생성 시 정상 동작 + 이전 vault 보존', async ({ page }) => {
      // 1. 첫 번째 볼트 생성
      await createVault(page, { fileName: 'vault-one' });

      // 2. 새로고침 → /auth → "첫 화면으로 돌아가기"
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForURL('**/auth', { timeout: 10000 });

      await page.getByRole('button', { name: '첫 화면으로 돌아가기' }).click();
      await page.waitForURL('/', { timeout: 5000 });
      await expect(page.getByText('파일을 선택하세요')).toBeVisible({ timeout: 5000 });

      // 3. multi-vault: 이전 vault 행 보존 확인
      await expectDbFilesContain(page, ['vault-one.json']);
      await expect(page.getByTestId('file-list-item')).toHaveCount(1);

      // 4. 스토어 초기화 검증
      await expectStoresReset(page, 'Auth - 첫 화면으로 돌아가기 후 (두 번째 볼트 생성 전)');

      // 5. 두 번째 볼트 생성 (다른 이름)
      await createVault(page, { fileName: 'vault-two' });

      // 정상적으로 /accounts 이동
      await expect(page.locator('section.min-h-svh')).toBeVisible({ timeout: 5000 });

      // 6. multi-vault: db.files에 두 row 보존
      await expectDbFilesContain(page, ['vault-one.json', 'vault-two.json']);
    });

    test('Settings에서 "파일변경" 후 다시 볼트 생성 시 정상 동작 + 이전 vault 보존', async ({ page }) => {
      // 1. 첫 번째 볼트 생성
      await createVault(page, { fileName: 'vault-settings-one' });

      // 2. Settings → 파일변경
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.waitForURL('**/settings', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      const fileChangeRow = page.locator('text=파일변경').locator('..');
      await fileChangeRow.locator('button:has-text("이동")').click();

      await page.waitForURL('/', { timeout: 5000 });
      await expect(page.getByText('파일을 선택하세요')).toBeVisible({ timeout: 5000 });

      // 3. multi-vault: 이전 vault 행 보존 확인
      await expectDbFilesContain(page, ['vault-settings-one.json']);
      await expect(page.getByTestId('file-list-item')).toHaveCount(1);

      // 4. 스토어 초기화 검증
      await expectStoresReset(page, 'Settings - 파일변경 후 (두 번째 볼트 생성 전)');

      // 5. 두 번째 볼트 생성
      await createVault(page, { fileName: 'vault-settings-two' });

      // 정상적으로 /accounts 이동
      await expect(page.locator('section.min-h-svh')).toBeVisible({ timeout: 5000 });

      // 6. multi-vault: 두 row 보존
      await expectDbFilesContain(page, ['vault-settings-one.json', 'vault-settings-two.json']);
    });
  });

  test.describe('같은 이름 재시도 → (1) suffix 부여 (multi-vault 핵심)', () => {
    test('vault-one 생성 → close → 같은 이름으로 재시도 → vault-one(1).json 생성', async ({ page }) => {
      // 1. vault-one 생성
      await createVault(page, { fileName: 'vault-one' });

      // 2. 새로고침 → /auth → "첫 화면으로 돌아가기"
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForURL('**/auth', { timeout: 10000 });

      await page.getByRole('button', { name: '첫 화면으로 돌아가기' }).click();
      await page.waitForURL('/', { timeout: 5000 });

      // 3. Home에 vault-one.json 1개 보임
      await expect(page.getByText('vault-one.json')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('file-list-item')).toHaveCount(1);
      await expectDbFilesContain(page, ['vault-one.json']);

      // 4. 같은 이름 vault-one으로 다시 생성 시도
      await createVault(page, { fileName: 'vault-one' });

      // 5. /accounts 이동 (suffix 적용되어 생성됨)
      await expect(page).toHaveURL(/\/accounts/);

      // 6. db.files에 vault-one.json + vault-one(1).json 두 row 보존
      await expectDbFilesContain(page, ['vault-one(1).json', 'vault-one.json']);

      // 7. 다시 close → Home에서 두 row 리스트에 보임
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForURL('**/auth', { timeout: 10000 });

      await page.getByRole('button', { name: '첫 화면으로 돌아가기' }).click();
      await page.waitForURL('/', { timeout: 5000 });
    });
  });
});
