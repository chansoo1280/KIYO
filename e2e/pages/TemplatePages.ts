import { type Page, type Locator, expect } from '@playwright/test';

export class TemplateListPage {
  readonly page: Page;
  readonly newTemplateButton: Locator;
  readonly templateCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newTemplateButton = page.getByRole('button', { name: '+ 템플릿 생성' });
    this.templateCards = page.locator('[data-testid="template-card"]').filter({ has: page.getByRole('button', { name: '수정' }) });
    this.emptyState = page.getByText('등록된 템플릿이 없습니다.');  // 마침표 추가
  }

  async goto(): Promise<void> {
    // 이미 /templates에 있으면 스킵
    if (this.page.url().includes('/templates')) {
      return;
    }
    // BottomTabs의 Templates 탭 클릭 (client-side navigation으로 Zustand 유지)
    const templatesTab = this.page.locator('button[aria-label="Templates"]').first();
    await templatesTab.waitFor({ state: 'visible', timeout: 10000 });
    await templatesTab.click();
    await this.page.waitForLoadState('networkidle');
    // 템플릿 카드 또는 빈 상태가 나타날 때까지 대기
    await Promise.race([
      this.page.waitForSelector('[data-testid="template-card"]', { timeout: 10000 }),
      this.page.waitForSelector('text=등록된 템플릿이 없습니다', { timeout: 10000 }),
    ]);
  }

  async createTemplate(): Promise<void> {
    await this.newTemplateButton.click();
    await this.page.waitForURL('**/templates/new', { timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
  }

  async clickTemplate(name: string): Promise<void> {
    // 템플릿 카드들을 모두 가져와서 이름으로 찾기
    const cards = this.page.locator('[data-testid="template-card"]');
    const count = await cards.count();
    
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const title = await card.locator('h3.font-semibold').textContent();
      if (title?.trim() === name) {
        await card.getByRole('button', { name: '수정' }).click();
        await this.page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 10000 });
        await this.page.waitForLoadState('networkidle');
        return;
      }
    }
    throw new Error(`템플릿 "${name}"을 찾을 수 없습니다`);
  }

  async getTemplateNames(): Promise<string[]> {
    const items = await this.page.locator('[data-testid="template-card"] h3').all();
    const names: string[] = [];
    for (const item of items) {
      const text = await item.textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  async expectTemplateCount(count: number): Promise<void> {
    if (count === 0) {
      await expect(this.emptyState).toBeVisible({ timeout: 5000 });
    } else {
      await expect(this.templateCards).toHaveCount(count);
    }
  }
}

export class TemplateEditPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly addFieldButton: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;
  readonly deleteConfirmModal: Locator;
  readonly confirmDeleteButton: Locator;
  readonly errorMessages: Locator;
  readonly fieldEditors: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input[placeholder="예: 로그인, API 키, 신용카드"]');
    this.descriptionInput = page.locator('textarea[placeholder="이 템플릿에 대한 설명을 입력하세요."]');
    this.addFieldButton = page.getByRole('button', { name: '+ 필드 추가' });
    this.saveButton = page.getByRole('button', { name: '저장' });
    this.cancelButton = page.getByRole('button', { name: '취소' });
    this.deleteButton = page.getByRole('button', { name: '삭제' }).first();
    this.deleteConfirmModal = page.getByRole('dialog').filter({ hasText: '템플릿 삭제' });
    this.confirmDeleteButton = this.deleteConfirmModal.getByRole('button', { name: '삭제' });
    this.errorMessages = page.locator('[data-testid="template-edit-error"] li');
    // TemplateFieldEditor 각각의 컨테이너: "필드 삭제" 버튼(✕)을 가진 div
    // Removed: fieldEditors dead code (Plan-X: E2E Selector Hardening)
  }

  async gotoNew(): Promise<void> {
    // BottomTabs의 Templates 탭 → 새 템플릿 생성 버튼으로 client-side navigation
    const templatesTab = this.page.locator('button[aria-label="Templates"]').first();
    await templatesTab.waitFor({ state: 'visible', timeout: 10000 });
    await templatesTab.click();
    await this.page.waitForLoadState('networkidle');
    await this.newTemplateButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.newTemplateButton.click();
    await this.page.waitForURL('**/templates/new', { timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
  }

  async gotoEdit(id: string): Promise<void> {
    // BottomTabs의 Templates 탭 → 템플릿 리스트에서 client-side navigation
    const templatesTab = this.page.locator('button[aria-label="Templates"]').first();
    await templatesTab.waitFor({ state: 'visible', timeout: 10000 });
    await templatesTab.click();
    await this.page.waitForLoadState('networkidle');
    await this.clickTemplate(id); // clickTemplate가 내부에서 이동 처리
  }

  async setName(name: string): Promise<void> {
    await this.nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.nameInput.fill(name);
  }

  async setDescription(description: string): Promise<void> {
    await this.descriptionInput.fill(description);
  }

  async addField(fieldDef: {
    type: string;
    label: string;
    required?: boolean;
    defaultValue?: string;
    placeholder?: string;
    options?: string[];
  }): Promise<void> {
    await this.addFieldButton.click();
    await this.page.waitForTimeout(300);
    
    // 마지막으로 추가된 필드 에디터 (가장 마지막 fieldEditors)
    const count = await this.fieldEditors.count();
    if (count === 0) {
      throw new Error('필드 에디터를 찾을 수 없습니다');
    }
    const newField = this.fieldEditors.nth(count - 1);
    
    // 라벨 입력 (placeholder: "항목 이름")
    await newField.locator('input[placeholder="항목 이름"]').fill(fieldDef.label);
    
    // 타입 선택 (combobox 역할)
    await newField.getByRole('combobox').selectOption(fieldDef.type);
    
    // 타입 변경 후 렌더링 대기
    await this.page.waitForTimeout(300);
    
    // select 타입인 경우 options 입력 (textarea에 줄별로 입력)
    if (fieldDef.type === 'select' && fieldDef.options) {
      // field editor 내의 textarea 찾기 (select 타입일 때만 나타남)
      const optionsTextarea = newField.locator('textarea').first();
      await optionsTextarea.waitFor({ state: 'attached', timeout: 5000 });
      const optionsText = fieldDef.options.join('\n');
      await optionsTextarea.fill(optionsText);
    }
  }

  async updateField(index: number, fieldDef: Partial<{
    type: string;
    label: string;
    required: boolean;
    defaultValue: string;
    placeholder: string;
    options: string[];
  }>): Promise<void> {
    const field = this.fieldEditors.nth(index);
    
    if (fieldDef.label) {
      await field.locator('input[placeholder="항목 이름"]').fill(fieldDef.label);
    }
    if (fieldDef.type) {
      await field.getByRole('combobox').selectOption(fieldDef.type);
    }
  }

  async deleteField(index: number): Promise<void> {
    const field = this.fieldEditors.nth(index);
    await field.getByRole('button', { name: '필드 삭제' }).click();
  }

  async moveFieldUp(index: number): Promise<void> {
    const field = this.fieldEditors.nth(index);
    await field.getByRole('button', { name: '위로 이동' }).click();
  }

  async moveFieldDown(index: number): Promise<void> {
    const field = this.fieldEditors.nth(index);
    await field.getByRole('button', { name: '아래로 이동' }).click();
  }

  async getFields(): Promise<{ label: string; type: string }[]> {
    const count = await this.fieldEditors.count();
    const result: { label: string; type: string }[] = [];
    
    for (let i = 0; i < count; i++) {
      const field = this.fieldEditors.nth(i);
      const label = await field.locator('input[placeholder="항목 이름"]').inputValue();
      const type = await field.getByRole('combobox').inputValue();
      result.push({ label, type });
    }
    return result;
  }

  async save(): Promise<void> {
    await this.saveButton.click();
    await this.page.waitForURL(/\/templates($|\/)/, { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    // 템플릿 리스트가 로드될 때까지 추가 대기 (빈 상태 또는 카드 중 하나)
    await Promise.race([
      this.page.waitForSelector('[data-testid="template-card"]', { timeout: 10000 }),
      this.page.waitForSelector('text=등록된 템플릿이 없습니다', { timeout: 10000 }),
    ]);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.page.waitForURL('/templates', { timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
    await expect(this.deleteConfirmModal).toBeVisible({ timeout: 5000 });
    await this.confirmDeleteButton.click();
    await this.page.waitForURL('/templates', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async expectFieldCount(count: number): Promise<void> {
    await expect(this.fieldEditors).toHaveCount(count);
  }

  async expectFieldAt(index: number, expected: { label: string; type: string }): Promise<void> {
    const field = this.fieldEditors.nth(index);
    await expect(field.locator('input[placeholder="항목 이름"]')).toHaveValue(expected.label);
    await expect(field.getByRole('combobox')).toHaveValue(expected.type);
  }

  async expectError(message: string): Promise<void> {
    await expect(this.errorMessages.filter({ hasText: message })).toBeVisible({ timeout: 5000 });
  }
}