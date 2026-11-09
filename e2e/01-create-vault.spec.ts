import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';

/**
 * Plan-7a: 볼트 생성 흐름 (Vault Creation)
 * 모달 → /create-vault 단일 라우트 페이지로 전환됨
 * Step 1 (이름) → 다음 → Step 2 (PIN) → 생성 → /accounts
 */
test.describe('볼트 생성 (Vault Creation) — Plan-7a 페이지 기반', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    // localStorage도 정리 (세션 persist 방지)
    await page.evaluate(() => localStorage.clear());
  });

  test('암호화 볼트 생성 2단계 흐름', async ({ page }) => {
    // 1. Home에서 "파일 생성" 클릭 → /create-vault 페이지로 이동
    await page.getByTestId('create-vault-link').click();
    await page.waitForURL('**/create-vault', { timeout: 10000 });

    // 2. Stepper 1단계 표시 확인
    await expect(page.getByTestId('create-vault-stepper')).toBeVisible();
    const stepper = page.getByTestId('create-vault-stepper');
    await expect(stepper.getByText('이름')).toBeVisible();
    await expect(stepper.getByText('PIN')).toBeVisible();

    // 3. Step 1: 파일 이름 입력
    const nameInput = page.getByTestId('create-vault-name-input');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('test-vault');

    // 4. "다음" 버튼 클릭
    await page.getByTestId('create-vault-next').click();

    // 5. Step 2: PIN 입력 필드 표시
    const pinInput = page.getByTestId('create-vault-pin-input');
    await expect(pinInput).toBeVisible();
    await pinInput.fill(TEST_PIN);

    // 6. Step 2에 파일명 표시 확인 (D3-a)
    await expect(page.getByTestId('create-vault-target-name')).toContainText(
      'test-vault.json',
    );

    // 7. "생성" 버튼 클릭
    await page.getByTestId('create-vault-submit').click();

    // 8. /accounts로 이동 확인
    await page.waitForURL('**/accounts', { timeout: 10000 });
    await expect(page).toHaveURL(/\/accounts$/);
  });

  test('이전 버튼 + PIN 클리어 (Q17-b)', async ({ page }) => {
    // Step 1 → Step 2
    await page.getByTestId('create-vault-link').click();
    await page.getByTestId('create-vault-name-input').fill('test-back');
    await page.getByTestId('create-vault-next').click();

    // PIN 입력
    const pinInput = page.getByTestId('create-vault-pin-input');
    await pinInput.fill('1234');

    // "이전" 클릭 → Step 1
    await page.getByTestId('create-vault-back').click();

    // 파일명 유지, Step 1으로 돌아옴
    await expect(page.getByTestId('create-vault-name-input')).toHaveValue('test-back');

    // 다시 Step 2로
    await page.getByTestId('create-vault-next').click();

    // PIN이 클리어되었는지 확인
    await expect(page.getByTestId('create-vault-pin-input')).toHaveValue('');
  });

  test('빈 파일명: 다음 버튼 enabled, 누르면 defaultValue 적용', async ({ page }) => {
    await page.getByTestId('create-vault-link').click();

    // 입력 비움 — 다음 버튼은 enabled (defaultValue로 채움)
    const nextButton = page.getByTestId('create-vault-next');
    await expect(nextButton).toBeEnabled();

    // 에러 메시지 visible하지 않음
    await expect(page.getByTestId('create-vault-name-error')).not.toBeVisible();

    // 다음 클릭 → Step 2로 이동
    await nextButton.click();
    await expect(page).toHaveURL(/\/create-vault/);
    // Step 2의 target name이 defaultValue "my-accounts"로 설정됨
    await expect(page.getByTestId('create-vault-target-name')).toContainText(
      'my-accounts.json',
    );
  });

  test('위험 문자: 인라인 에러 + 다음 버튼 disabled (Q11-c, Q12-a)', async ({ page }) => {
    await page.getByTestId('create-vault-link').click();
    const nameInput = page.getByTestId('create-vault-name-input');
    await nameInput.fill('test/file');

    // 에러 메시지 visible
    await expect(page.getByTestId('create-vault-name-error')).toBeVisible();
    await expect(page.getByTestId('create-vault-name-error')).toContainText(
      '문자를 사용할 수 없습니다',
    );

    // 다음 버튼 disabled
    await expect(page.getByTestId('create-vault-next')).toBeDisabled();
  });

  test('길이 초과 (51자): 인라인 에러 + 다음 버튼 disabled', async ({ page }) => {
    await page.getByTestId('create-vault-link').click();
    const nameInput = page.getByTestId('create-vault-name-input');
    await nameInput.fill('a'.repeat(51));

    await expect(page.getByTestId('create-vault-name-error')).toBeVisible();
    await expect(page.getByTestId('create-vault-name-error')).toContainText(
      '50자 이하',
    );
    await expect(page.getByTestId('create-vault-next')).toBeDisabled();
  });

  test('입력 수정 시 에러 자동 클리어 (Q16-a)', async ({ page }) => {
    await page.getByTestId('create-vault-link').click();
    const nameInput = page.getByTestId('create-vault-name-input');
    await nameInput.fill('test/bad');

    // 에러 visible
    await expect(page.getByTestId('create-vault-name-error')).toBeVisible();

    // 정상 문자로 수정
    await nameInput.fill('test-good');

    // 에러 사라짐
    await expect(page.getByTestId('create-vault-name-error')).not.toBeVisible();
    // 다음 버튼 활성화
    await expect(page.getByTestId('create-vault-next')).toBeEnabled();
  });

  test('PIN 4자 미만: 생성 버튼 disabled (Q13-b, Q14-1)', async ({ page }) => {
    await page.getByTestId('create-vault-link').click();
    await page.getByTestId('create-vault-name-input').fill('test-pin');
    await page.getByTestId('create-vault-next').click();

    const pinInput = page.getByTestId('create-vault-pin-input');
    await pinInput.fill('123'); // 3자

    await expect(page.getByTestId('create-vault-submit')).toBeDisabled();
  });

  test('취소: 홈으로 버튼 (←) → / 이동', async ({ page }) => {
    await page.getByTestId('create-vault-link').click();
    await page.waitForURL('**/create-vault');

    // ← 버튼 클릭
    await page.getByRole('button', { name: '홈으로' }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 5000 });
  });
});
