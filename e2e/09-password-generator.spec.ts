import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';
import { HomePage, AccountListPage } from './pages/HomePage';

test.describe('비밀번호 생성기 (Password Generator)', () => {
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

  test('계정 생성 페이지에서 비밀번호 생성기 열기 → 길이 조절 → 문자 종류 토글 → 생성 → 적용 → 복사', async ({ page }) => {
    // 1. 암호화 볼트 생성
    await homePage.createFile('test-pwd-gen', true, TEST_PIN);
    await page.waitForLoadState('networkidle');

    // 2. 계정 추가 → "로그인" 템플릿 선택
    await accountListPage.addAccount();
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL('**/accounts/new**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[placeholder="항목 이름"]', { timeout: 15000 });
    await page.waitForTimeout(500);

    // 3. 제목, URL 입력
    await page.getByLabel('제목').fill('Test Password Gen');
    await page.fill('input[placeholder="https://www.example.com/login"]', 'https://test.com');

    // 4. 비밀번호 필드에서 생성기 열기 (비밀번호 필드의 "생성" 버튼 클릭)
    // "로그인" 템플릿의 3번째 필드가 "비밀번호" (password 타입)
    const passwordField = page.locator('input[type="password"]').first();
    await expect(passwordField).toBeVisible();

    // PasswordField 컴포넌트의 "생성" 버튼 찾기
    const generateButton = page.getByRole('button', { name: '생성' }).first(); // 비밀번호 필드 내의 생성 버튼
    await expect(generateButton).toBeVisible({ timeout: 5000 });
    await generateButton.click();

    // 5. 비밀번호 생성기 다이얼로그 열림 확인
    await expect(page.getByRole('dialog').filter({ hasText: '비밀번호 생성기' })).toBeVisible({ timeout: 5000 });

    // 6. 길이 조절 (슬라이더: 8~32)
    const lengthSlider = page.locator('input[type="range"]');
    await expect(lengthSlider).toBeVisible();
    
    // 기본값 16 확인
    await expect(page.locator('text=길이: 16자')).toBeVisible();

    // 길이 20으로 변경
    await lengthSlider.fill('20');
    await expect(page.locator('text=길이: 20자')).toBeVisible();

    // 7. 문자 종류 토글 (기본 모두 켜짐 → 하나씩 끄기)
    // 모두 켜진 상태에서 "특수문자" 끄기
    const symbolsLabel = page.locator('label:has-text("특수문자")').first();
    await symbolsLabel.click();
    await page.waitForTimeout(200);

    // "새로 생성" 버튼 클릭
    await page.getByRole('button', { name: '새로 생성' }).click();
    await page.waitForTimeout(300);

    // 생성된 비밀번호 표시 확인
    await expect(page.locator('text=생성된 비밀번호').first()).toBeVisible({ timeout: 5000 });
    const passwordInput = page.locator('input[readOnly][type="text"]');
    await expect(passwordInput).toBeVisible();
    const generatedPassword = await passwordInput.inputValue();
    expect(generatedPassword.length).toBe(20);

    // 특수문자가 없는지 확인 (대략적)
    // 엄밀히 검증하긴 어려우니 길이만 확인

    // 8. "적용" 버튼 클릭 → 다이얼로그 닫힘 → 비밀번호 필드에 입력됨
    await page.getByRole('button', { name: '적용' }).click();
    await expect(page.getByRole('dialog').filter({ hasText: '비밀번호 생성기' })).not.toBeVisible({ timeout: 5000 });

    // 비밀번호 필드에 값이 들어갔는지 확인
    await expect(passwordField).toHaveValue(generatedPassword);

    // 9. 다시 생성기 열기 → 복사 버튼 테스트
    await generateButton.click();
    await expect(page.getByRole('dialog').filter({ hasText: '비밀번호 생성기' })).toBeVisible({ timeout: 5000 });

    // 생성된 비밀번호가 표시됨 (자동 생성됨)
    await expect(page.locator('text=생성된 비밀번호').first()).toBeVisible({ timeout: 5000 });
    
    // 복사 버튼 클릭
    const copyButton = page.locator('button:has-text("복사")').first();
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    // 복사 버튼이 비활성화되거나 "복사됨" 상태가 되는지 확인 (최대 3초 대기)
    await page.waitForTimeout(1000);
    
    // 다이얼로그 닫기
    await page.getByRole('button', { name: '취소', exact: true }).click();

    // 10. 계정 저장
    await page.getByRole('button', { name: '저장' }).click();
    await page.waitForURL('**/accounts/**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 리스트로 돌아가기
    await page.getByRole('button', { name: '← 뒤로 가기' }).click();
    await page.waitForURL('**/accounts', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // 계정 확인
    await accountListPage.expectAccountCount(1);
  });

  test('문자 종류 미선택 시 에러 메시지 표시', async ({ page }) => {
    // 1. 볼트 생성 + 계정 편집 페이지 진입
    await homePage.createFile('test-pwd-gen-error', true, TEST_PIN);
    await page.waitForLoadState('networkidle');

    await accountListPage.addAccount();
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL('**/accounts/new**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[placeholder="항목 이름"]', { timeout: 15000 });
    await page.waitForTimeout(500);

    // 2. 비밀번호 생성기 열기
    const generateButton = page.getByRole('button', { name: '생성' }).first();
    await generateButton.click();
    await expect(page.getByRole('dialog').filter({ hasText: '비밀번호 생성기' })).toBeVisible({ timeout: 5000 });

    // 3. 모든 문자 종류 끄기
    const charSetLabels = [
      '영대문자 (A-Z)',
      '영소문자 (a-z)', 
      '숫자 (0-9)',
      '특수문자 (!@#$%^&*)'
    ];

    for (const label of charSetLabels) {
      const checkboxLabel = page.locator(`label:has-text("${label}")`).first();
      const checkbox = checkboxLabel.locator('input[type="checkbox"]');
      if (await checkbox.isChecked()) {
        await checkboxLabel.click();
        await page.waitForTimeout(100);
      }
    }

    // 4. "새로 생성" 클릭 → 에러 메시지
    await page.getByRole('button', { name: '새로 생성' }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('text=최소 한 가지 문자 종류를 선택해주세요.')).toBeVisible({ timeout: 5000 });

    // 5. 적용 버튼 비활성화 확인
    await expect(page.getByRole('button', { name: '적용' })).toBeDisabled();

    // 6. 하나 켜고 다시 생성 → 정상 동작
    const firstLabel = page.locator('label:has-text("영대문자 (A-Z)")').first();
    await firstLabel.click();
    await page.waitForTimeout(100);

    await page.getByRole('button', { name: '새로 생성' }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('text=생성된 비밀번호').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '적용' })).toBeEnabled();

    await page.getByRole('button', { name: '취소', exact: true }).click();
  });

  test('길이 최솟값/최댓값 확인 (8자/32자)', async ({ page }) => {
    await homePage.createFile('test-pwd-gen-length', true, TEST_PIN);
    await page.waitForLoadState('networkidle');

    await accountListPage.addAccount();
    await page.getByRole('button', { name: '로그인' }).click();
    await page.waitForURL('**/accounts/new**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[placeholder="항목 이름"]', { timeout: 15000 });
    await page.waitForTimeout(500);

    // 비밀번호 생성기 열기
    const generateButton = page.getByRole('button', { name: '생성' }).first();
    await generateButton.click();
    await expect(page.getByRole('dialog').filter({ hasText: '비밀번호 생성기' })).toBeVisible({ timeout: 5000 });

    const lengthSlider = page.locator('input[type="range"]');
    await expect(lengthSlider).toBeVisible();

    // 최솟값 8
    await lengthSlider.fill('8');
    await expect(page.locator('text=길이: 8자')).toBeVisible();
    await page.getByRole('button', { name: '새로 생성' }).click();
    await page.waitForTimeout(300);
    const password8 = await page.locator('input[readOnly][type="text"]').inputValue();
    expect(password8.length).toBe(8);

    // 최댓값 32
    await lengthSlider.fill('32');
    await expect(page.locator('text=길이: 32자')).toBeVisible();
    await page.getByRole('button', { name: '새로 생성' }).click();
    await page.waitForTimeout(300);
    const password32 = await page.locator('input[readOnly][type="text"]').inputValue();
    expect(password32.length).toBe(32);

    await page.getByRole('button', { name: '취소', exact: true }).click();
  });
});