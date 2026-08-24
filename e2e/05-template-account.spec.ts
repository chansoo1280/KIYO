import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';
import { HomePage, AccountListPage } from './pages/HomePage';
import { TemplateListPage, TemplateEditPage } from './pages/TemplatePages';

test.describe('템플릿으로 계정 생성 (Template to Account)', () => {
  let homePage: HomePage;
  let accountListPage: AccountListPage;
  let templateListPage: TemplateListPage;
  let templateEditPage: TemplateEditPage;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());

    homePage = new HomePage(page);
    accountListPage = new AccountListPage(page);
    templateListPage = new TemplateListPage(page);
    templateEditPage = new TemplateEditPage(page);

    // 암호화 볼트 생성 후 홈으로 이동
    await homePage.createFile('test-template-account', true, TEST_PIN);
  });

  test('새 템플릿 생성 → 해당 템플릿으로 계정 생성 → 저장 → 상세에서 필드 값 검증', async ({ page }) => {
    // 1. 설정 → 템플릿 관리 → 새 템플릿 생성 ("신용카드": 카드번호/텍스트, 만료일/날짜, CVC/숫자, 카드사/선택)
    await accountListPage.clickSettings();
    await templateListPage.goto();
    await templateListPage.createTemplate();

    await templateEditPage.setName('신용카드');
    // 빈 템플릿에서 필드 추가 (addField 사용)
    await templateEditPage.addField({ type: 'text', label: '카드번호' });
    await templateEditPage.addField({ type: 'date', label: '만료일' });
    await templateEditPage.addField({ type: 'number', label: 'CVC' });
    await templateEditPage.addField({ type: 'select', label: '카드사', options: ['Visa', 'Mastercard', 'Amex'] });
    await templateEditPage.save();

    // 2. 리스트로 이동 (PIN 입력 자동 처리)
    await accountListPage.goto();

    // 3. 계정 추가 → 방금 만든 "신용카드" 템플릿 선택
    await accountListPage.addAccount();
    await page.getByRole('dialog').filter({ hasText: '템플릿 선택' }).getByRole('button', { name: '신용카드' }).click();
    await page.waitForURL('**/accounts/new**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[placeholder="항목 이름"]', { timeout: 15000 });

    // 4. 템플릿 기반 폼 자동 생성 확인 (4개 필드, 순서대로 표시)
    const fieldEditors = page.locator('div.mt-3.space-y-3 > div.rounded-2xl.border').filter({ has: page.getByRole('button', { name: '삭제' }) });
    await expect(fieldEditors).toHaveCount(4);
    await expect(fieldEditors.nth(0).locator('input[placeholder="항목 이름"]')).toHaveValue('카드번호');
    await expect(fieldEditors.nth(1).locator('input[placeholder="항목 이름"]')).toHaveValue('만료일');
    await expect(fieldEditors.nth(2).locator('input[placeholder="항목 이름"]')).toHaveValue('CVC');
    await expect(fieldEditors.nth(3).locator('input[placeholder="항목 이름"]')).toHaveValue('카드사');

    // 5. 필수 필드 모두 입력 후 저장
    await page.getByLabel('제목').fill('테스트 카드');
    await page.fill('input[placeholder="https://www.example.com/login"]', 'https://test.com');

    // 필드 값 입력 (AccountEdit.tsx 구조: 필드 컨테이너 바로 아래 value input이 위치)
    // text: placeholder="입력하세요", date: type="date", number: type="number", select: select (value input)
    await fieldEditors.nth(0).locator('input[placeholder="입력하세요"]').fill('1111 2222 3333 4444');
    await fieldEditors.nth(1).locator('input[type="date"]').fill('2025-12-31');
    await fieldEditors.nth(2).locator('input[type="number"]').fill('123');
    // select 타입은 필드 타입 선택 combobox + value select가 모두 있으므로 value용 select 선택 (두 번째 select)
    await fieldEditors.nth(3).locator('select').nth(1).selectOption('Visa');

    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForURL('**/accounts/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 6. 리스트로 돌아가서 계정 확인
    await page.getByRole('button', { name: '← 뒤로 가기' }).click();
    await page.waitForURL('**/accounts', { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await accountListPage.expectAccountCount(1);
    await accountListPage.clickAccount('테스트 카드');

    // 7. 계정 상세에서 템플릿 필드 값들이 그대로 저장되었는지 검증
    await expect(page.locator('text=테스트 카드')).toBeVisible();
    await expect(page.locator('text=1111 2222 3333 4444')).toBeVisible();
    await expect(page.locator('text=2025-12-31')).toBeVisible();
    await expect(page.locator('text=123')).toBeVisible();
    await expect(page.locator('text=Visa')).toBeVisible();
  });
});