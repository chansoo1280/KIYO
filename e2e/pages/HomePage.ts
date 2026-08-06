import { type Page, type Locator, expect } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly createFileButton: Locator;
  readonly openFileButton: Locator;
  readonly fileCreateDialog: Locator;
  readonly fileOpenDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createFileButton = page.getByRole('button', { name: '파일 생성' });
    this.openFileButton = page.getByRole('button', { name: '파일 선택' });
    this.fileCreateDialog = page.getByRole('dialog').filter({ hasText: '새 파일 생성' });
    this.fileOpenDialog = page.getByRole('dialog').filter({ hasText: '파일 열기' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async createFile(fileName: string, encrypted: boolean = true, pin?: string): Promise<void> {
    await this.createFileButton.click();
    await expect(this.fileCreateDialog).toBeVisible({ timeout: 5000 });
    
    const fileNameInput = this.fileCreateDialog.locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
    await expect(fileNameInput).toBeVisible();
    await fileNameInput.fill(fileName);
    
    if (!encrypted) {
      const encryptedCheckbox = this.fileCreateDialog.locator('input[type="checkbox"]');
      if (await encryptedCheckbox.isChecked()) {
        await encryptedCheckbox.uncheck();
      }
      await expect(this.fileCreateDialog.locator('input[type="password"]')).not.toBeVisible({ timeout: 5000 });
    } else if (pin) {
      const pinInput = this.fileCreateDialog.locator('input[type="password"]').first();
      await expect(pinInput).toBeVisible();
      await pinInput.fill(pin);
    }
    
    await this.fileCreateDialog.getByRole('button', { name: '생성' }).click();
    await this.page.waitForURL('**/list', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
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
    // 이미 /list에 있으면 스킵
    if (this.page.url().includes('/list')) {
      return;
    }
    // client-side navigation via bottom tab to preserve session (cryptoKey in memory)
    // BottomTab 컴포넌트의 List 탭은 aria-label="List" 또는 텍스트 "📋"를 가짐
    const listTab = this.page.locator('button[aria-label="List"], button:has-text("📋")').first();
    if (await listTab.count() > 0 && await listTab.isVisible()) {
      await listTab.click();
      // /auth 또는 /list 중 어디로 가든 대기 (암호화 볼트는 세션 복구 전 /auth로 리다이렉트됨)
      await Promise.race([
        this.page.waitForURL('**/auth', { timeout: 10000 }),
        this.page.waitForURL('**/list', { timeout: 10000 })
      ]);
      // /auth라면 PIN 입력 후 /list 대기
      if (this.page.url().includes('/auth')) {
        await this.page.fill('input[type="password"]', '1234');
        await this.page.getByRole('button', { name: '확인' }).click();
        await this.page.waitForURL('**/list', { timeout: 10000 });
      }
      await this.page.waitForLoadState('networkidle');
      // 플로팅 액션 버튼이 렌더링될 때까지 대기
      await this.addAccountButton.waitFor({ state: 'visible', timeout: 10000 });
      return;
    }
    throw new Error('BottomTabs를 찾을 수 없습니다. client-side navigation 필요.');
  }

  async addAccount(): Promise<void> {
    // 계정 리스트 페이지(/list)에 있지 않으면 이동
    if (!this.page.url().includes('/list')) {
      await this.goto();
    }
    // goto에서 이미 버튼 대기함
    await this.addAccountButton.click();
    await expect(this.templatePickerDialog).toBeVisible({ timeout: 5000 });
  }

  async selectTemplate(templateName: string): Promise<void> {
    await this.templatePickerDialog.getByRole('button', { name: templateName }).click();
    await this.page.waitForURL('**/account/edit**', { timeout: 10000 });
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
    await this.page.waitForURL('**/account/**', { timeout: 5000 });
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