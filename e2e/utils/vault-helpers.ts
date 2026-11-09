import { type Page } from '@playwright/test';
import { TEST_PIN } from '../fixtures/test-data';
import { createVault } from './vault-creation';

/**
 * 테스트용 볼트 생성 및 잠금 해제까지 수행
 * Plan-7a: createVault() 유틸을 호출 — /create-vault 페이지 기반
 */
export async function createTestVault(page: Page, pin: string = TEST_PIN): Promise<void> {
  // 홈 화면으로 명시적 이동 (multi-vault E2E 등 이전 상태 정리)
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await createVault(page, { pin });
}

/**
 * 수동 잠금
 */
export async function lockVault(page: Page): Promise<void> {
  // 잠금 버튼 찾기 (헤더/네비게이션의 잠금 아이콘 또는 버튼)
  const lockButton = page.locator('button[aria-label*="잠금"], button:has-text("잠금"), [data-testid="lock-button"]').first();
  await lockButton.click();
  
  // 인증 페이지로 이동 대기
  await page.waitForURL('**/', { timeout: 5000 });
  await page.waitForSelector('input[type="password"]', { timeout: 5000 });
}

/**
 * PIN으로 잠금 해제
 */
export async function unlockVault(page: Page, pin: string = TEST_PIN): Promise<void> {
  const pinInput = page.locator('input[type="password"]').first();
  await pinInput.fill(pin);
  
  const unlockButton = page.locator('button:has-text("잠금 해제"), button:has-text("확인"), button[type="submit"]').first();
  await unlockButton.click();
  
  // 홈 화면으로 리다이렉트 대기
  await page.waitForURL('**/', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

/**
 * 테스트용 계정 데이터 시드 (여러 계정 생성)
 */
export async function seedTestAccounts(page: Page): Promise<void> {
  const accounts = [
    { name: 'GitHub', url: 'https://github.com', username: 'devuser', password: 'GitHub123!', note: 'Personal GitHub', favorite: true },
    { name: 'Gmail', url: 'https://gmail.com', username: 'myemail@gmail.com', password: 'Gmail456!', note: 'Personal email', favorite: false },
    { name: 'AWS Console', url: 'https://aws.amazon.com/console', username: 'awsuser', password: 'AWS789!', note: 'Work AWS account', favorite: true },
    { name: 'Slack', url: 'https://slack.com', username: 'slackuser', password: 'Slack111!', note: 'Team workspace', favorite: false },
    { name: 'Notion', url: 'https://notion.so', username: 'notionuser', password: 'Notion222!', note: 'Personal wiki', favorite: false },
  ];
  
  for (const account of accounts) {
    await createAccount(page, account);
  }
}

/**
 * 계정 생성 헬퍼 (홈 화면에서)
 */
export async function createAccount(page: Page, account: {
  name: string;
  url: string;
  username: string;
  password: string;
  note?: string;
  favorite?: boolean;
}): Promise<void> {
  // 계정 추가 버튼 클릭
  const addButton = page.locator('button:has-text("계정 추가"), button:has-text("추가"), [data-testid="add-account-button"]').first();
  await addButton.click();
  
  // 계정 편집 페이지 로드 대기
  await page.waitForURL('**/accounts/**', { timeout: 5000 });
  await page.waitForLoadState('networkidle');
  
  // 폼 채우기
  await page.fill('input[name="name"], input[placeholder*="이름"], [data-testid="account-name"]', account.name);
  await page.fill('input[name="url"], input[placeholder*="URL"], [data-testid="account-url"]', account.url);
  await page.fill('input[name="username"], input[placeholder*="사용자명"], [data-testid="account-username"]', account.username);
  await page.fill('input[name="password"], input[type="password"][placeholder*="비밀번호"], [data-testid="account-password"]', account.password);
  
  if (account.note) {
    await page.fill('textarea[name="note"], textarea[placeholder*="메모"], [data-testid="account-note"]', account.note);
  }
  
  if (account.favorite) {
    const favCheckbox = page.locator('input[name="favorite"], [data-testid="account-favorite"]').first();
    if (await favCheckbox.count() > 0) {
      await favCheckbox.check();
    }
  }
  
  // 저장
  const saveButton = page.locator('button:has-text("저장"), button[type="submit"]').first();
  await saveButton.click();
  
  // 홈으로 리다이렉트 대기
  await page.waitForURL('**/', { timeout: 5000 });
  await page.waitForLoadState('networkidle');
}