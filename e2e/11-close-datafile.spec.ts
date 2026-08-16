import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';

// 헬퍼: 스토어 상태 확인
async function checkStoresReset(page: import('@playwright/test').Page) {
  const accountStore = await page.evaluate(() => {
    // @ts-expect-error - accessing debug window property
    return window.__KIYO_DEBUG__?.getAccountStore?.() ?? null;
  });
  const templateStore = await page.evaluate(() => {
    // @ts-expect-error - accessing debug window property
    return window.__KIYO_DEBUG__?.getTemplateStore?.() ?? null;
  });
  const sessionStore = await page.evaluate(() => {
    // @ts-expect-error - accessing debug window property
    return window.__KIYO_DEBUG__?.getSession?.() ?? null;
  });
  return { accountStore, templateStore, sessionStore };
}

async function expectStoresReset(page: import('@playwright/test').Page, context: string) {
  const { accountStore, templateStore, sessionStore } = await checkStoresReset(page);
  
  // 세션 스토어는 clearSession + deleteFileRecord 후 초기화되어야 함
  expect(sessionStore, `${context}: sessionStore should be reset`).toEqual({
    activeFileName: null,
    hasCryptoKey: false,
    hasSalt: false,
  });
  
  // 계정 스토어는 clearAccounts가 호출되지 않았지만, 새 볼트 생성 시 loadAccounts가 다시 호출되므로
  // 여기서는 initialized가 false여야 함 (loadAccounts가 아직 안 불렸으므로)
  if (accountStore) {
    expect(accountStore.initialized, `${context}: accountStore.initialized should be false`).toBe(false);
    expect(accountStore.accountsCount, `${context}: accountStore.accountsCount should be 0`).toBe(0);
  }
  
  // 템플릿 스토어도 마찬가지
  if (templateStore) {
    expect(templateStore.initialized, `${context}: templateStore.initialized should be false`).toBe(false);
    expect(templateStore.templatesCount, `${context}: templateStore.templatesCount should be 0`).toBe(0);
  }
}

test.describe('closeDataFile (세션 초기화 및 파일 선택 화면 이동)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());
  });

  test.describe('Auth 페이지 - "첫 화면으로 돌아가기" 버튼', () => {
    test('암호화 볼트 생성 → 언락 후 → "첫 화면으로 돌아가기" 클릭 시 Home으로 이동하고 파일 선택 다이얼로그 표시', async ({ page }) => {
      // 1. 암호화 볼트 생성
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await expect(fileNameInput).toBeVisible();
      await fileNameInput.fill('test-back-to-home');

      const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
      await expect(pinInput).toBeVisible();
      await pinInput.fill(TEST_PIN);

      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

      // 최초 생성 시 바로 /accounts 이동
      await page.waitForURL('**/accounts', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 2. 새로고침으로 잠금 유도 (/auth로 리다이렉트)
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForURL('**/auth', { timeout: 10000 });
      await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('PIN 번호', { exact: true })).toBeVisible();

      // 3. "첫 화면으로 돌아가기" 버튼 클릭 (뒤로 가기 화살표 아이콘 버튼)
      const backButton = page.getByRole('button', { name: '첫 화면으로 돌아가기' });
      await expect(backButton).toBeVisible({ timeout: 5000 });
      await backButton.click();

      // 4. Home 페이지(/)로 이동하고 파일 선택 상태(selectFile) 진입 확인
      // URL은 / 이고, 파일 생성/선택 다이얼로그 중 하나가 열려 있어야 함
      await page.waitForURL('/', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // "파일을 선택하세요" 텍스트가 보여야 함 (Home 페이지)
      await expect(page.getByText('파일을 선택하세요', { exact: true })).toBeVisible({ timeout: 5000 });

      // 파일 생성 버튼이 보여야 함
      await expect(page.getByRole('button', { name: '파일 생성' })).toBeVisible({ timeout: 5000 });

      // 5. 스토어들이 제대로 초기화되었는지 검증
      await expectStoresReset(page, 'Auth - 첫 화면으로 돌아가기 후');
    });

    
  });

  test.describe('Settings 페이지 - "파일변경" 버튼', () => {
    test('암호화 볼트 생성 → Settings 진입 → "파일변경" 클릭 시 Home으로 이동하고 파일 선택 화면 표시', async ({ page }) => {
      // 1. 암호화 볼트 생성
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await expect(fileNameInput).toBeVisible();
      await fileNameInput.fill('test-settings-file-change');

      const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
      await expect(pinInput).toBeVisible();
      await pinInput.fill(TEST_PIN);

      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

      await page.waitForURL('**/accounts', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 2. Settings 페이지로 이동 (BottomTabs의 ⚙️ 버튼)
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.waitForURL('**/settings', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 3. "파일변경" 버튼 찾기 및 클릭
      const fileChangeRow = page.locator('text=파일변경').locator('..');
      await expect(fileChangeRow.locator('button:has-text("이동")')).toBeVisible({ timeout: 5000 });
      await fileChangeRow.locator('button:has-text("이동")').click();

      // 4. Home 페이지(/)로 이동하고 파일 선택 상태 진입 확인
      await page.waitForURL('/', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // "파일을 선택하세요" 텍스트가 보여야 함
      await expect(page.getByText('파일을 선택하세요', { exact: true })).toBeVisible({ timeout: 5000 });

      // 파일 생성/파일 선택 버튼들이 보여야 함
      await expect(page.getByRole('button', { name: '파일 생성' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: '파일 선택' })).toBeVisible({ timeout: 5000 });

      // 5. 스토어들이 제대로 초기화되었는지 검증
      await expectStoresReset(page, 'Settings - 파일변경 후 (암호화 볼트)');
    });

    test('비암호화 볼트에서도 Settings → "파일변경" 동작 확인', async ({ page }) => {
      // 1. 비암호화 볼트 생성
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await expect(fileNameInput).toBeVisible();
      await fileNameInput.fill('test-unencrypted-file-change');

      const encryptedCheckbox = page.getByRole('dialog').locator('input[type="checkbox"]');
      await expect(encryptedCheckbox).toBeChecked();
      await encryptedCheckbox.uncheck();

      await expect(page.getByRole('dialog').locator('input[type="password"]')).not.toBeVisible({ timeout: 5000 });

      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

      await page.waitForURL('**/accounts', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 2. Settings 페이지로 이동
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.waitForURL('**/settings', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 3. "파일변경" 버튼 클릭
      const fileChangeRow = page.locator('text=파일변경').locator('..');
      await expect(fileChangeRow.locator('button:has-text("이동")')).toBeVisible({ timeout: 5000 });
      await fileChangeRow.locator('button:has-text("이동")').click();

      // 4. Home 페이지로 이동 및 파일 선택 화면 확인
      await page.waitForURL('/', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('파일을 선택하세요', { exact: true })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: '파일 생성' })).toBeVisible({ timeout: 5000 });

      // 5. 스토어들이 제대로 초기화되었는지 검증
      await expectStoresReset(page, 'Settings - 파일변경 후 (비암호화 볼트)');
    });
  });

  test.describe('closeDataFile 호출 후 세션 상태 초기화 검증', () => {
    test('Auth에서 "첫 화면으로 돌아가기" 후 다시 볼트 생성 시 정상 동작', async ({ page }) => {
      // 1. 첫 번째 볼트 생성 및 언락
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      let fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await fileNameInput.fill('vault-one');
      const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
      await pinInput.fill(TEST_PIN);
      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

      await page.waitForURL('**/accounts', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 2. 새로고침 → /auth → "첫 화면으로 돌아가기"
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForURL('**/auth', { timeout: 10000 });

      await page.getByRole('button', { name: '첫 화면으로 돌아가기' }).click();
      await page.waitForURL('/', { timeout: 5000 });
      await expect(page.getByText('파일을 선택하세요')).toBeVisible({ timeout: 5000 });

      // 3. 스토어들이 제대로 초기화되었는지 검증 (두 번째 볼트 생성 전)
      await expectStoresReset(page, 'Auth - 첫 화면으로 돌아가기 후 (두 번째 볼트 생성 전)');

      // 4. 두 번째 볼트 생성 (세션이 초기화되어야 정상 생성됨)
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await fileNameInput.fill('vault-two');
      const pinInput2 = page.getByRole('dialog').locator('input[type="password"]').first();
      await pinInput2.fill(TEST_PIN);
      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

      // 4. 정상적으로 /accounts 이동 확인
      await page.waitForURL('**/accounts', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await expect(page.locator('section.min-h-svh')).toBeVisible({ timeout: 5000 });
    });

    test('Settings에서 "파일변경" 후 다시 볼트 생성 시 정상 동작', async ({ page }) => {
      // 1. 첫 번째 볼트 생성
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      let fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await fileNameInput.fill('vault-settings-one');
      const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
      await pinInput.fill(TEST_PIN);
      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

      await page.waitForURL('**/accounts', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 2. Settings → 파일변경
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.waitForURL('**/settings', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      const fileChangeRow = page.locator('text=파일변경').locator('..');
      await fileChangeRow.locator('button:has-text("이동")').click();

      await page.waitForURL('/', { timeout: 5000 });
      await expect(page.getByText('파일을 선택하세요')).toBeVisible({ timeout: 5000 });

      // 3. 스토어들이 제대로 초기화되었는지 검증 (두 번째 볼트 생성 전)
      await expectStoresReset(page, 'Settings - 파일변경 후 (두 번째 볼트 생성 전)');

      // 4. 두 번째 볼트 생성
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await fileNameInput.fill('vault-settings-two');
      const pinInput2 = page.getByRole('dialog').locator('input[type="password"]').first();
      await pinInput2.fill(TEST_PIN);
      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

      // 4. 정상적으로 /accounts 이동 확인
      await page.waitForURL('**/accounts', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await expect(page.locator('section.min-h-svh')).toBeVisible({ timeout: 5000 });
    });
  });
});