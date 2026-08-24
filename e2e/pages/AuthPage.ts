import { type Page, type Locator, expect } from '@playwright/test';

export class AuthPage {
  readonly page: Page;
  readonly pinInput: Locator;
  readonly pinConfirmInput: Locator;
  readonly createButton: Locator;
  readonly unlockButton: Locator;
  readonly errorMessage: Locator;
  readonly biometricButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pinInput = page.locator('input[type="password"]').first();
    this.pinConfirmInput = page.locator('input[type="password"]').nth(1);
    this.createButton = page.locator('button:has-text("생성"), button:has-text("확인"), button[type="submit"]').first();
    this.unlockButton = page.locator('button:has-text("잠금 해제"), button:has-text("확인"), button[type="submit"]').first();
    this.errorMessage = page.locator('[data-testid="error-message"], .error-message, .toast-error, [role="alert"]').first();
    this.biometricButton = page.locator('button:has-text("생체인증"), button[aria-label*="생체인증"]').first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async createPin(pin: string, confirmPin?: string): Promise<void> {
    // PIN 생성 화면 대기
    await this.pinInput.waitFor({ state: 'visible', timeout: 10000 });
    
    const inputs = this.page.locator('input[type="password"]');
    const count = await inputs.count();
    
    if (count >= 2) {
      // PIN 생성 화면 (PIN + 확인)
      await this.pinInput.fill(pin);
      await this.pinConfirmInput.fill(confirmPin ?? pin);
      await this.createButton.click();
    } else {
      // 이미 볼트가 있는 경우 - PIN만 입력
      await this.pinInput.fill(pin);
      await this.unlockButton.click();
    }
    
    // 홈 화면으로 리다이렉트 대기
    await this.page.waitForURL('**/', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async unlockWithPin(pin: string): Promise<void> {
    await this.pinInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.pinInput.fill(pin);
    await this.unlockButton.click();
    
    // 홈 화면으로 리다이렉트 대기
    await this.page.waitForURL('**/', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async expectError(message: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 5000 });
    await expect(this.errorMessage).toContainText(message);
  }

  async expectLocked(): Promise<void> {
    await expect(this.pinInput).toBeVisible({ timeout: 5000 });
    await expect(this.page).toHaveURL(/\/$/);
  }

  async expectVaultCreated(): Promise<void> {
    // 홈 화면 요소 확인 (계정 리스트 또는 빈 상태)
    await this.page.waitForSelector('[data-testid="account-list"], [data-testid="empty-state"], .account-list, main', { 
      timeout: 5000 
    });
  }
}