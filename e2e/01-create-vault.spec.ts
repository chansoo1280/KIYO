import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';

test.describe('볼트 생성 (Vault Creation)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    // localStorage도 정리 (세션 persist 방지)
    await page.evaluate(() => localStorage.clear());
  });

  test('최초 실행 시 암호화 볼트 생성 후 바로 계정 리스트(/list)로 이동한다', async ({ page }) => {
    // 1. 앱 최초 실행 - Home 페이지에서 파일 생성 다이얼로그 열기
    await expect(page.getByRole('button', { name: '파일 생성' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '파일 생성' }).click();
    
    // 2. 파일 생성 다이얼로그 확인 (role="dialog"인 div)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: '새 파일 생성' })).toBeVisible();
    
    // 3. 파일 이름 입력
    const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill('test-vault');
    
    // 4. 암호화 체크박스 확인 (기본값이 true)
    const encryptedCheckbox = page.getByRole('dialog').locator('input[type="checkbox"]');
    await expect(encryptedCheckbox).toBeChecked();
    
    // 5. PIN 입력
    const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
    await expect(pinInput).toBeVisible();
    await pinInput.fill(TEST_PIN);
    
    // 6. 생성 버튼 클릭
    await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();
    
    // 7. 암호화 볼트 최초 생성 시 바로 /list로 이동 (세션이 이미 설정되어 있음)
    await page.waitForURL('**/list', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // 8. 계정 리스트 페이지 확인 (테스트 모드에서는 빈 리스트)
    const accountListContainer = page.locator('section.min-h-svh').first();
    await expect(accountListContainer).toBeVisible({ timeout: 5000 });
    
    // 9. 계정 리스트가 비어있음 (dev 계정 생성 안 함)
    const accountItems = page.locator('article[role="button"]');
    await expect(await accountItems.count()).toBe(0);
  });

  test('비암호화 볼트 생성 시 PIN 없이 바로 계정 리스트로 이동', async ({ page }) => {
    // 파일 생성 다이얼로그 열기
    await page.getByRole('button', { name: '파일 생성' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: '새 파일 생성' })).toBeVisible();
    
    // 파일 이름 입력
    const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill('test-vault-unencrypted');
    
    // 암호화 체크박스 해제
    const encryptedCheckbox = page.getByRole('dialog').locator('input[type="checkbox"]');
    await expect(encryptedCheckbox).toBeChecked();
    await encryptedCheckbox.uncheck();
    
    // PIN 입력 필드가 사라져야 함
    await expect(page.getByRole('dialog').locator('input[type="password"]')).not.toBeVisible({ timeout: 5000 });
    
    // 생성 버튼 클릭
    await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();
    
    // 바로 /list로 이동 (인증 페이지 거치지 않음)
    await page.waitForURL('**/list', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // 계정 리스트 페이지 확인
    const accountListContainer = page.locator('section.min-h-svh').first();
    await expect(accountListContainer).toBeVisible({ timeout: 5000 });
  });

  test('잘못된 PIN으로 암호화 볼트 열기 시도 시 에러 발생', async ({ page }) => {
    // 1. 암호화 볼트 생성
    await page.getByRole('button', { name: '파일 생성' }).click();
    
    const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill('test-vault-wrong-pin');
    
    const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
    await expect(pinInput).toBeVisible();
    await pinInput.fill(TEST_PIN);
    
    await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();
    
    // 2. 바로 /list로 이동 확인 (최초 생성 시)
    await page.waitForURL('**/list', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // 3. 페이지 새로고침 (cryptoKey는 localStorage에 persist되지 않으므로 /auth로 이동)
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 4. 세션의 cryptoKey가 없어서 /auth로 리다이렉트됨 (보안상 올바른 동작)
    await page.waitForURL('**/auth', { timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('PIN 번호', { exact: true })).toBeVisible();
    
    // 5. 잘못된 PIN 입력 시 에러 메시지
    await page.fill('input[type="password"]', 'wrong-pin');
    await page.getByRole('button', { name: '확인' }).click();
    
    // 에러 메시지 표시 확인 (catch 블록에서 "PIN verification failed"로 감싸서 표시됨)
    await expect(page.locator('[role="alert"]').filter({ hasText: 'PIN 불일치' })).toBeVisible({ timeout: 5000 });
  });

  test('PIN 입력 없이 암호화 볼트 생성 시도 시 에러 메시지', async ({ page }) => {
    // 파일 생성 다이얼로그 열기
    await page.getByRole('button', { name: '파일 생성' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    
    // 파일 이름 입력
    const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill('test-vault-no-pin');
    
    // PIN 입력하지 않음 (암호화 체크된 상태)
    // 생성 버튼이 비활성화되어 있어야 함
    const createButton = page.getByRole('dialog').getByRole('button', { name: '생성' });
    await expect(createButton).toBeDisabled();
    
    // PIN 입력 후 버튼 활성화 확인
    const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
    await expect(pinInput).toBeVisible();
    await pinInput.fill(TEST_PIN);
    await expect(createButton).toBeEnabled();
  });
});