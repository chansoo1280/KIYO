import { type Page, expect } from '@playwright/test';

export interface CreateVaultOptions {
  /** 파일 이름 (확장자 제외). 미지정 시 timestamp 기반 자동 생성. */
  fileName?: string;
  /** PIN. 기본값: TEST_PIN. encrypted=false면 무시됨. */
  pin?: string;
  /**
   * true (default): 암호화 볼트 생성 (PIN 필요)
   * false: 비암호화 볼트 생성 (PIN 건너뛰기)
   */
  encrypted?: boolean;
  /**
   * true (default): create-vault-link 클릭해서 /create-vault로 이동
   * false: 이미 /create-vault 페이지에 있을 때 (Step 1부터 시작)
   */
  navigateToPage?: boolean;
}

const DEFAULT_PIN = '1234';

/**
 * 페이지 기반 vault 생성 공통 유틸 (Plan-7a).
 *
 * 흐름:
 * 1. /create-vault 페이지로 이동 (옵션)
 * 2. Step 1: 파일 이름 입력 → "다음"
 * 3. Step 2:
 *    - encrypted=true (default): PIN 입력 → "생성"
 *    - encrypted=false: "비밀번호 없이 만들기" 클릭
 * 4. /accounts 도달 대기
 *
 * 사용 예:
 *   await createVault(page);                                  // 암호화, 자동 fileName
 *   await createVault(page, { fileName: 'my-vault' });        // 암호화
 *   await createVault(page, { encrypted: false });            // 비암호화
 *   await createVault(page, { pin: '5678' });                 // 다른 PIN
 */
export async function createVault(
  page: Page,
  options: CreateVaultOptions = {},
): Promise<{ fileName: string; pin?: string; encrypted: boolean }> {
  const {
    fileName = `test-vault-${Date.now()}`,
    pin = DEFAULT_PIN,
    encrypted = true,
    navigateToPage = true,
  } = options;

  if (navigateToPage) {
    const link = page.getByTestId('create-vault-link');
    if ((await link.count()) > 0) {
      await link.first().click();
    } else {
      await page.goto('/create-vault');
    }
    await page.waitForURL('**/create-vault', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  // Step 1: 파일 이름 입력 → "다음"
  const nameInput = page.getByTestId('create-vault-name-input');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(fileName);
  await page.getByTestId('create-vault-next').click();

  // Step 2
  if (encrypted) {
    // PIN 입력 → "생성"
    const pinInput = page.getByTestId('create-vault-pin-input');
    await pinInput.waitFor({ state: 'visible', timeout: 5000 });
    await pinInput.fill(pin);
    await page.getByTestId('create-vault-submit').click();
  } else {
    // "비밀번호 없이 만들기" 클릭
    const skipButton = page.getByTestId('create-vault-skip-pin');
    await skipButton.waitFor({ state: 'visible', timeout: 5000 });
    await skipButton.click();
  }

  // /accounts 도달 대기
  await page.waitForURL('**/accounts', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  return { fileName, pin: encrypted ? pin : undefined, encrypted };
}

/**
 * /create-vault 페이지로 직접 이동 (이미 page 있는 경우).
 * Step 1부터 시작.
 */
export async function getToCreateVaultPage(page: Page): Promise<void> {
  if (page.url().endsWith('/create-vault')) {
    return;
  }
  const link = page.getByTestId('create-vault-link');
  if ((await link.count()) > 0) {
    await link.first().click();
  } else {
    await page.goto('/create-vault');
  }
  await expect(page).toHaveURL('**/create-vault');
}
