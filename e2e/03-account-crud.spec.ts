import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';

// 헬퍼: 라벨 텍스트로 동적 필드의 값 입력란 찾기
async function fillDynamicField(page: import('@playwright/test').Page, labelText: string, value: string) {
  // 라벨 편집 필드("항목 이름" placeholder)에서 labelText를 값(value)으로 가진 것 찾기
  const labelInputByValue = page.locator(`input[placeholder="항목 이름"][value="${labelText}"]`);
  await labelInputByValue.waitFor({ state: 'attached', timeout: 5000 });
  
  // 같은 필드 컨테이너(부모) 내의 값 입력 필드 찾기
  const fieldContainer = labelInputByValue.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  
  let valueInput;
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

test.describe('계정 CRUD (Account CRUD)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await page.evaluate(() => localStorage.clear());
  });

  test.describe('계정 생성 (Create)', () => {
    test('계정 생성 버튼 클릭 → 필수 필드 입력 → 저장 → 리스트에 표시', async ({ page }) => {
      // 1. 볼트 생성 (암호화)
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

      const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await expect(fileNameInput).toBeVisible();
      await fileNameInput.fill('test-account-crud');

      const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
      await expect(pinInput).toBeVisible();
      await pinInput.fill(TEST_PIN);

      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();

      await page.waitForURL('**/list', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 2. 계정 추가 버튼 클릭 (aria-label="Add account"인 + 버튼)
      await page.getByRole('button', { name: 'Add account' }).click();
      
      // 3. TemplatePicker에서 "기본 템플릿" 클릭
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: '기본 템플릿' }).click();
      
      // 4. 계정 편집 페이지 로드 대기
      await page.waitForURL('**/account/edit**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 5. 필수 필드 입력
      // 고정 필드들 (레이블로 찾기)
      await fillFixedField(page, '제목', 'Test Account');
      await fillFixedField(page, '웹사이트 URL (자동완성용)', 'https://example.com');
      
      // 동적 필드들 (TemplatePicker의 기본 템플릿)
      await fillDynamicField(page, '아이디/이메일', 'testuser');
      
      // 비밀번호 필드 (PasswordField 컴포넌트)
      const passwordField = page.locator('input[type="password"]').first();
      if (await passwordField.count() > 0) {
        await passwordField.fill('TestPass123!');
      }
      
      // 메모 필드
      await fillDynamicField(page, '메모', 'Test note');

      // 6. 저장
      await page.getByRole('button', { name: '저장' }).click();

      // 7. 상세 페이지(/account)로 리다이렉트 확인
      await page.waitForURL('**/account**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 리스트로 돌아가서 계정 표시 확인
      await page.getByRole('button', { name: '← 뒤로 가기' }).click();
      await page.waitForURL('**/list', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 8. 리스트에 계정 표시 확인
      await expect(page.locator('article[role="button"]').filter({ hasText: 'Test Account' })).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('계정 조회 (Read)', () => {
    test.beforeEach(async ({ page }) => {
      // 사전 준비: 볼트 생성 + 계정 1개 생성
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await fileNameInput.fill('test-read-account');
      const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
      await pinInput.fill(TEST_PIN);
      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();
      await page.waitForURL('**/list', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 계정 생성
      await page.getByRole('button', { name: 'Add account' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: '기본 템플릿' }).click();
      
      await page.waitForURL('**/account/edit**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await fillFixedField(page, '제목', 'Read Test Account');
      await fillFixedField(page, '웹사이트 URL (자동완성용)', 'https://readtest.com');
      await fillDynamicField(page, '아이디/이메일', 'readuser');
      const passwordField = page.locator('input[type="password"]').first();
      if (await passwordField.count() > 0) {
        await passwordField.fill('ReadPass456!');
      }
      await fillDynamicField(page, '메모', 'Read test note');
      await page.getByRole('button', { name: '저장' }).click();
      await page.waitForURL('**/account**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      
      // 리스트로 돌아가기
      await page.getByRole('button', { name: '← 뒤로 가기' }).click();
      await page.waitForURL('**/list', { timeout: 5000 });
      await page.waitForLoadState('networkidle');
    });

    test('계정 클릭 → 상세 페이지에서 모든 필드 값 확인', async ({ page }) => {
      // 계정 클릭
      await page.locator('article[role="button"]').filter({ hasText: 'Read Test Account' }).click();
      
      // 상세 페이지 로드 대기
      await page.waitForURL('**/account/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 필드 값 확인 (웹사이트 URL은 상세 뷰에 표시되지 않음 - 자동완성용)
      await expect(page.locator('text=Read Test Account')).toBeVisible();
      await expect(page.locator('text=readuser')).toBeVisible();
      await expect(page.locator('text=Read test note')).toBeVisible();
    });

    test('비밀번호 표시/숨기기 토글 동작', async ({ page }) => {
      // 계정 클릭
      await page.locator('article[role="button"]').filter({ hasText: 'Read Test Account' }).click();
      await page.waitForURL('**/account/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 비밀번호 표시/숨기기 토글 버튼 찾기
      const toggleButton = page.locator('button[aria-label*="표시"], button[aria-label*="숨기기"], button:has-text("표시"), button:has-text("숨기기")').first();
      if (await toggleButton.count() > 0) {
        await toggleButton.click();
        await page.waitForTimeout(200);
        
        // 비밀번호가 평문으로 표시되는지 확인
        await expect(page.locator('text=ReadPass456!')).toBeVisible({ timeout: 5000 });
        
        // 다시 클릭하여 숨기기
        await toggleButton.click();
        await page.waitForTimeout(200);
      }
    });
  });

  test.describe('계정 수정 (Update)', () => {
    test.beforeEach(async ({ page }) => {
      // 사전 준비: 볼트 생성 + 계정 1개 생성
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await fileNameInput.fill('test-update-account');
      const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
      await pinInput.fill(TEST_PIN);
      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();
      await page.waitForURL('**/list', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 계정 생성
      await page.getByRole('button', { name: 'Add account' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: '기본 템플릿' }).click();
      
      await page.waitForURL('**/account/edit**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await fillFixedField(page, '제목', 'Original Account');
      await fillFixedField(page, '웹사이트 URL (자동완성용)', 'https://original.com');
      await fillDynamicField(page, '아이디/이메일', 'originaluser');
      const passwordField = page.locator('input[type="password"]').first();
      if (await passwordField.count() > 0) {
        await passwordField.fill('OriginalPass123!');
      }
      await page.getByRole('button', { name: '저장' }).click();
      await page.waitForURL('**/account**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      
      // 리스트로 돌아가기
      await page.getByRole('button', { name: '← 뒤로 가기' }).click();
      await page.waitForURL('**/list', { timeout: 5000 });
      await page.waitForLoadState('networkidle');
    });

    test('계정 상세에서 편집 클릭 → 필드 수정 후 저장 → 변경사항 반영', async ({ page }) => {
      // 계정 클릭 → 상세 페이지
      await page.locator('article[role="button"]').filter({ hasText: 'Original Account' }).click();
      await page.waitForURL('**/account/**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 편집 버튼 클릭 ("수정" 버튼)
      await page.getByRole('button', { name: '수정' }).click();
      await page.waitForURL('**/account/edit**', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 필드 수정
      await fillFixedField(page, '제목', 'Updated Account');
      await fillFixedField(page, '웹사이트 URL (자동완성용)', 'https://updated.com');
      await fillDynamicField(page, '아이디/이메일', 'updateduser');
      
      const passwordField = page.locator('input[type="password"]').first();
      if (await passwordField.count() > 0) {
        await passwordField.fill('UpdatedPass789!');
      }
      
      await fillDynamicField(page, '메모', 'Updated note');

      // 저장
      await page.getByRole('button', { name: '저장' }).click();
      await page.waitForURL('**/account**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 리스트로 돌아가서 변경사항 확인
      await page.getByRole('button', { name: '← 뒤로 가기' }).click();
      await page.waitForURL('**/list', { timeout: 5000 });
      await page.waitForLoadState('networkidle');

      // 변경사항 확인
      await expect(page.locator('article[role="button"]').filter({ hasText: 'Updated Account' })).toBeVisible({ timeout: 5000 });
      
      // 상세 페이지에서 값 재확인
      await page.locator('article[role="button"]').filter({ hasText: 'Updated Account' }).click();
      await page.waitForURL('**/account/**', { timeout: 5000 });
      await expect(page.locator('text=updateduser')).toBeVisible();
      await expect(page.locator('text=Updated note')).toBeVisible();
    });
  });

  test.describe('계정 삭제 (Delete)', () => {
    test.beforeEach(async ({ page }) => {
      // 사전 준비: 볼트 생성 + 계정 1개 생성
      await page.getByRole('button', { name: '파일 생성' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      const fileNameInput = page.getByRole('dialog').locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first();
      await fileNameInput.fill('test-delete-account');
      const pinInput = page.getByRole('dialog').locator('input[type="password"]').first();
      await pinInput.fill(TEST_PIN);
      await page.getByRole('dialog').getByRole('button', { name: '생성' }).click();
      await page.waitForURL('**/list', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 계정 생성
      await page.getByRole('button', { name: 'Add account' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: '기본 템플릿' }).click();
      
      await page.waitForURL('**/account/edit**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await fillFixedField(page, '제목', 'Delete Test Account');
      await fillFixedField(page, '웹사이트 URL (자동완성용)', 'https://delete.com');
      await fillDynamicField(page, '아이디/이메일', 'deleteuser');
      const passwordField = page.locator('input[type="password"]').first();
      if (await passwordField.count() > 0) {
        await passwordField.fill('DeletePass123!');
      }
      await page.getByRole('button', { name: '저장' }).click();
      await page.waitForURL('**/account**', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    });

    test('편집 화면에서 삭제 버튼 → 확인 모달에서 "삭제" 클릭 → 리스트에서 사라짐', async ({ page }) => {
      // 이미 상세 페이지에 있음 (beforeEach에서 계정 생성 후 상세 페이지로 리다이렉트됨)
      // 삭제 버튼 클릭 (상세 페이지 헤더의 삭제 버튼 - 첫 번째)
      await page.locator('button:has-text("삭제")').first().click();

      // 확인 모달에서 삭제 클릭 (모달 내의 삭제 버튼 - 빨간색 버튼)
      await page.locator('button.bg-red-600:has-text("삭제")').click({ timeout: 5000 });

      // 리스트로 리다이렉트 대기
      await page.waitForURL('**/list', { timeout: 10000 });
      await page.waitForLoadState('networkidle');

      // 리스트에서 계정 사라짐 확인
      await expect(page.locator('article[role="button"]').filter({ hasText: 'Delete Test Account' })).not.toBeVisible({ timeout: 5000 });
    });
  });
});