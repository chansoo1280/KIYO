import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';
import { HomePage, AccountListPage } from './pages/HomePage';

// 헬퍼: 라벨 텍스트로 동적 필드의 값 입력란 찾기
async function fillDynamicField(page: import('@playwright/test').Page, labelText: string, value: string) {
  const labelInputs = page.getByPlaceholder('항목 이름');
  const count = await labelInputs.count();

  let targetLabelInput: import('@playwright/test').Locator | null = null;

  for (let i = 0; i < count; i++) {
    const input = labelInputs.nth(i);
    const inputValue = await input.inputValue();
    if (inputValue === labelText) {
      targetLabelInput = input;
      break;
    }
  }

  if (!targetLabelInput) {
    throw new Error(`Label input with text "${labelText}" not found`);
  }

  const fieldContainer = targetLabelInput.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');

  let valueInput: import('@playwright/test').Locator;
  if (labelText === '메모') {
    valueInput = fieldContainer.locator('textarea');
  } else if (labelText === '비밀번호') {
    valueInput = fieldContainer.locator('input[type="password"]');
  } else if (labelText === '아이디/이메일') {
    valueInput = fieldContainer.locator('input[type="email"]');
  } else {
    valueInput = fieldContainer.locator('input[type="text"], input[type="url"], input[type="number"]').first();
  }

  await valueInput.waitFor({ state: 'visible', timeout: 5000 });
  await valueInput.fill(value);
}

// 헬퍼: 레이블로 고정 필드 찾기
async function fillFixedField(page: import('@playwright/test').Page, label: string, value: string) {
  const input = page.getByLabel(label);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(value);
}

// 헬퍼: 계정 생성 (기본 템플릿 사용)
async function createAccount(page: import('@playwright/test').Page, account: {
  title: string;
  url: string;
  username: string;
  password: string;
  note: string;
}) {
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByRole('button', { name: '기본 템플릿' }).click();
  await page.waitForURL('**/account/edit**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[placeholder="항목 이름"]', { timeout: 15000 });
  await page.waitForTimeout(500);

  await fillFixedField(page, '제목', account.title);
  await fillFixedField(page, '웹사이트 URL (자동완성용)', account.url);
  await fillDynamicField(page, '아이디/이메일', account.username);
  await fillDynamicField(page, '비밀번호', account.password);
  await fillDynamicField(page, '메모', account.note);

  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL('**/account/**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // 리스트로 돌아가기
  await page.getByRole('button', { name: '← 뒤로 가기' }).click();
  await page.waitForURL('**/list', { timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

test.describe('백업 내보내기 / 가져오기 (Import/Export)', () => {
  let homePage: HomePage;
  let accountListPage: AccountListPage;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());

    homePage = new HomePage(page);
    accountListPage = new AccountListPage(page);
  });

  test.describe('Export (백업 내보내기)', () => {
    test('계정 여러 개 생성 → 설정 → 백업 내보내기 → 파일 다운로드 확인', async ({ page }) => {
      // 1. 암호화 볼트 생성
      await homePage.createFile('test-export', true, TEST_PIN);
      await page.waitForLoadState('networkidle');

      // 2. 테스트 계정 3개 생성
      const accounts = [
        { title: 'GitHub', url: 'https://github.com', username: 'devuser', password: 'GitHub123!', note: 'Personal GitHub' },
        { title: 'Gmail', url: 'https://gmail.com', username: 'myemail@gmail.com', password: 'Gmail456!', note: 'Personal email' },
        { title: 'AWS Console', url: 'https://aws.amazon.com/console', username: 'awsuser', password: 'AWS789!', note: 'Work AWS' },
      ];

      for (const account of accounts) {
        await createAccount(page, account);
      }

      // 계정 3개 확인
      await accountListPage.expectAccountCount(3);

      // 3. 설정 → 백업 내보내기
      await accountListPage.clickSettings();
      await page.waitForLoadState('networkidle');

      // 백업 저장 버튼 클릭
      await page.getByRole('button', { name: '저장' }).first().click();
      await page.waitForLoadState('networkidle');

      // FileCreateDialog 열림 확인
      await expect(page.getByRole('dialog').filter({ hasText: '백업 파일 저장' })).toBeVisible({ timeout: 5000 });

      // 파일 이름 입력 - 암호화 체크박스 해제 (테스트용)
      const dialog = page.getByRole('dialog').filter({ hasText: '백업 파일 저장' });
      await dialog.locator('input[type="checkbox"]').uncheck();
      await dialog.getByRole('button', { name: '저장' }).click();

      // 다운로드 대기
      const downloadPromise = page.waitForEvent('download');
      await downloadPromise;

      // 성공 메시지 확인
      await expect(page.locator('text=백업 파일을 저장했습니다.')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Import (백업 가져오기)', () => {
    test('볼트 생성 + 계정 생성 + 백업 → 볼트 잠금 → PIN 언락 → 복원 다이얼로그 확인', async ({ page }) => {
      // 1. 볼트 생성 + 계정 1개 생성
      await homePage.createFile('test-import-source', true, TEST_PIN);
      await page.waitForLoadState('networkidle');

      await createAccount(page, {
        title: 'Import Test Account',
        url: 'https://import-test.com',
        username: 'importuser',
        password: 'ImportPass123!',
        note: 'Import test note',
      });

      // 2. 백업 내보내기 (암호화 없이)
      await accountListPage.clickSettings();
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '저장' }).first().click();
      await expect(page.getByRole('dialog').filter({ hasText: '백업 파일 저장' })).toBeVisible({ timeout: 5000 });
      const dialog = page.getByRole('dialog').filter({ hasText: '백업 파일 저장' });
      await dialog.locator('input[type="checkbox"]').uncheck();
      await dialog.getByRole('button', { name: '저장' }).click();
      await expect(page.locator('text=백업 파일을 저장했습니다.')).toBeVisible({ timeout: 5000 });

      // 3. 볼트 닫기 (새로고침으로 잠금 유도)
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForURL('**/auth', { timeout: 10000 });

      // 4. PIN 입력으로 언락
      await page.fill('input[type="password"]', TEST_PIN);
      await page.getByRole('button', { name: '확인' }).click();
      await page.waitForURL('**/list', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 5. 설정 → 복원 (불러오기) 다이얼로그 열림 확인
      await accountListPage.clickSettings();
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: '불러오기' }).click();
      await expect(page.getByRole('dialog').filter({ hasText: '파일 열기' })).toBeVisible({ timeout: 5000 });

      // 파일 열기 다이얼로그 UI 확인 (파일 선택 버튼)
      await expect(page.getByRole('dialog').filter({ hasText: '파일 열기' }).locator('text=파일 선택')).toBeVisible();
      
      // 파일 선택 전에는 파일 정보가 표시되지 않음 - 파일 선택 후 표시됨

      // 취소
      await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
    });
  });
});