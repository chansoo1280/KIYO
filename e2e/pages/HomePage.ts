import { type Page, type Locator, expect } from '@playwright/test';
import { createVault } from '../utils/vault-creation';

export class HomePage {
  readonly page: Page;
  readonly createFileLink: Locator;
  readonly openFileButton: Locator;
  readonly fileList: Locator;

  constructor(page: Page) {
    this.page = page;
    // Plan-7a: "파일 생성"은 <Link> (button 아님)
    this.createFileLink = page.getByTestId('create-vault-link');
    this.openFileButton = page.getByRole('button', { name: '파일 선택' });
    this.fileList = page.getByTestId('file-list');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Plan-7a: 페이지 기반 vault 생성. 옵션은 createVault() 위임.
   * @deprecated createVault() 유틸 직접 사용 권장
   */
  async createFile(fileName: string, encrypted: boolean = true, pin?: string): Promise<void> {
    await createVault(this.page, {
      fileName,
      encrypted,
      pin,
    });
  }
}

export class AccountListPage {
  readonly page: Page;
  readonly addAccountButton: Locator;
  readonly searchButton: Locator;
  readonly searchInput: Locator;
  readonly sortButton: Locator;
  readonly templatePickerDialog: Locator;
  readonly accountItems: Locator;
  readonly tagButtons: Locator;
  readonly fileName: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addAccountButton = page.locator('button[aria-label="Add account"]').first();
    this.searchButton = page.getByRole('button', { name: /Search|검색/ });
    this.searchInput = page.locator('input[placeholder="제목이나 이메일로 검색..."]');
    this.sortButton = page.getByRole('button', { name: /Sort|정렬/ });
    this.templatePickerDialog = page.getByRole('dialog').filter({ hasText: '템플릿 선택' });
    this.accountItems = page.locator('article[role="button"]');
    this.tagButtons = page.locator('button.rounded-full.px-3.py-1.5');
    this.fileName = page.locator('p.text-sm.text-\\[var\\(--color-text\\)\\]').first();
  }

  async goto(): Promise<void> {
    // 이미 /accounts에 있으면 스킵
    if (this.page.url().includes('/accounts')) {
      return;
    }
    // client-side navigation via bottom tab to preserve session (cryptoKey in memory)
    // BottomTab 컴포넌트의 List 탭은 aria-label="List" 또는 텍스트 "📋"를 가짐
    const listTab = this.page.locator('button[aria-label="List"], button:has-text("📋")').first();
    if (await listTab.count() > 0 && await listTab.isVisible()) {
      await listTab.click();
      // /auth 또는 /accounts 중 어디로 가든 대기 (암호화 볼트는 세션 복구 전 /auth로 리다이렉트됨)
      await Promise.race([
        this.page.waitForURL('**/auth', { timeout: 10000 }),
        this.page.waitForURL('**/accounts', { timeout: 10000 })
      ]);
      // /auth라면 PIN 입력 후 /accounts 대기
      if (this.page.url().includes('/auth')) {
        await this.page.fill('input[type="password"]', '1234');
        await this.page.getByRole('button', { name: '확인' }).click();
        await this.page.waitForURL('**/accounts', { timeout: 10000 });
      }
      await this.page.waitForLoadState('networkidle');
      // 플로팅 액션 버튼이 렌더링될 때까지 대기
      await this.addAccountButton.waitFor({ state: 'visible', timeout: 10000 });
      return;
    }
    throw new Error('BottomTabs를 찾을 수 없습니다. client-side navigation 필요.');
  }

  async addAccount(): Promise<void> {
    // 계정 리스트 페이지(/accounts)에 있지 않으면 이동
    if (!this.page.url().includes('/accounts')) {
      await this.goto();
    }
    // goto에서 이미 버튼 대기함
    await this.addAccountButton.click();
    await expect(this.templatePickerDialog).toBeVisible({ timeout: 5000 });
  }

  async selectTemplate(templateName: string): Promise<void> {
    await this.templatePickerDialog.getByRole('button', { name: templateName }).click();
    await this.page.waitForURL('**/accounts/new**', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
    // 템플릿 필드 로드 대기
    await this.page.waitForSelector('input[placeholder="항목 이름"]', { timeout: 15000 });
  }

  async search(query: string): Promise<void> {
    await this.searchButton.click();
    await expect(this.searchInput).toBeVisible();
    await this.searchInput.fill(query);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
  }

  async clickAccount(name: string): Promise<void> {
    await this.accountItems.filter({ hasText: name }).first().click();
    await this.page.waitForURL('**/accounts/**', { timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
  }

  async getAccountNames(): Promise<string[]> {
    const accounts = await this.accountItems.all();
    const names: string[] = [];
    for (const account of accounts) {
      const title = await account.locator('p.truncate.text-sm.font-semibold').textContent();
      if (title) names.push(title.trim());
    }
    return names;
  }

  async expectAccountCount(count: number): Promise<void> {
    await expect(this.accountItems).toHaveCount(count);
  }

  async clickSettings(): Promise<void> {
    // BottomTabs의 Settings 탭 클릭 (client-side navigation으로 Zustand 유지)
    const settingsTab = this.page.locator('button[aria-label="Settings"]').first();
    await settingsTab.waitFor({ state: 'visible', timeout: 10000 });
    await settingsTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickLock(): Promise<void> {
    await this.page.getByRole('button', { name: /잠금|Lock/ }).first().click();
    await this.page.waitForURL('**/auth', { timeout: 5000 });
  }
}