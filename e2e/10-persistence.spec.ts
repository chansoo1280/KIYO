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

  const fieldContainer = targetLabelInput.locator('xpath=ancestor::*[@data-testid="account-field-editor"][1]');

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

// 헬퍼: 계정 생성 (기본 템플릿 "로그인" 사용)
async function createAccount(page: import('@playwright/test').Page, account: {
  title: string;
  url: string;
  username: string;
  password: string;
  note: string;
}) {
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('**/accounts/new**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[placeholder="항목 이름"]', { timeout: 15000 });
  await page.waitForTimeout(500);

  await fillFixedField(page, '제목', account.title);
  await fillFixedField(page, '웹사이트 URL (자동완성용)', account.url);
  await fillDynamicField(page, '아이디/이메일', account.username);
  await fillDynamicField(page, '비밀번호', account.password);
  await fillDynamicField(page, '메모', account.note);

  await page.getByRole('button', { name: '저장' }).click();
  await page.waitForURL('**/accounts/**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // 리스트로 돌아가기
  await page.getByRole('button', { name: '← 뒤로 가기' }).click();
  await page.waitForURL('**/accounts', { timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

test.describe('데이터 지속성 (Persistence after Reload)', () => {
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

  test('설정(자동잠금, 테마, 글자크기) 유지 확인', async ({ page }) => {
    // 1. 암호화 볼트 생성
    await homePage.createFile('test-persistence-settings', true, TEST_PIN);
    await page.waitForLoadState('networkidle');

    // 2. 설정 변경
    await accountListPage.clickSettings();
    await page.waitForLoadState('networkidle');

    // 자동잠금 10분 설정
    const autoLockSelect = page.locator('select[aria-label="자동잠금 시간 선택"]');
    await expect(autoLockSelect).toBeVisible({ timeout: 5000 });
    await autoLockSelect.selectOption('10m');
    await expect(page.locator('text=자동잠금: 10분로 설정되었습니다.')).toBeVisible({ timeout: 5000 });

    // 다크모드 토글 (현재 상태와 반대로)
    const themeToggle = page.locator('button[role="switch"]').first();
    await expect(themeToggle).toBeVisible({ timeout: 5000 });
    const initialTheme = await themeToggle.getAttribute('aria-checked');
    await themeToggle.click();
    await page.waitForLoadState('networkidle');

    // 글자크기 "크게" 설정
    const fontSizeSelect = page.locator('select[aria-label="글자 크기 선택"]');
    await expect(fontSizeSelect).toBeVisible({ timeout: 5000 });
    await fontSizeSelect.selectOption('large');
    await expect(page.locator('text=글자크기: 크게로 변경되었습니다.')).toBeVisible({ timeout: 5000 });

    // 리스트로 돌아가기
    const listTab = page.locator('button[aria-label="List"], button:has-text("📋")').first();
    await listTab.click();
    await page.waitForURL('**/accounts', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // 3. 브라우저 새로고침
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 4. PIN 입력 후 잠금 해제
    await page.waitForURL('**/auth', { timeout: 10000 });
    await page.fill('input[type="password"]', TEST_PIN);
    await page.getByRole('button', { name: '확인' }).click();
    await page.waitForURL('**/accounts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 5. 설정 페이지로 가서 값 확인
    await accountListPage.clickSettings();
    await page.waitForLoadState('networkidle');

    // 자동잠금 10분 유지 확인
    await expect(autoLockSelect).toHaveValue('10m');

    // 다크모드 상태 유지 확인 (토글된 상태)
    const newTheme = await themeToggle.getAttribute('aria-checked');
    expect(newTheme).not.toBe(initialTheme);

    // 글자크기 "크게" 유지 확인
    await expect(fontSizeSelect).toHaveValue('large');
  });

  test('비암호화 볼트는 새로고침 후 PIN 없이 바로 접근 가능', async ({ page }) => {
    // 1. 비암호화 볼트 생성
    await homePage.createFile('test-unencrypted-persistence', false, TEST_PIN);
    await page.waitForLoadState('networkidle');

    // 2. 계정 1개 생성
    await createAccount(page, {
      title: 'Unencrypted Account',
      url: 'https://unencrypted.com',
      username: 'testuser',
      password: 'TestPass123!',
      note: 'Unencrypted test',
    });

    await accountListPage.expectAccountCount(1);

    // 3. 브라우저 새로고침
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 4. PIN 입력 없이 바로 /accounts 접근 가능해야 함
    await expect(page).toHaveURL(/\/accounts/);
    await accountListPage.addAccountButton.waitFor({ state: 'visible', timeout: 10000 });
    await accountListPage.expectAccountCount(1);

    // 5. 계정 데이터 확인 (비암호화 볼트는 바로 /accounts로 감)
    await accountListPage.clickAccount('Unencrypted Account');
    await page.waitForURL('**/accounts/**', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Unencrypted Account')).toBeVisible();
    await expect(page.locator('text=testuser')).toBeVisible();
    // 비밀번호는 마스킹되어 표시되므로 값 확인 생략
    await expect(page.locator('text=Unencrypted test')).toBeVisible();
  });

  test('암호화 볼트 데이터는 IndexedDB에 정확히 저장됨 (새로고침 후 복구 가능)', async ({ page }) => {
    // 1. 암호화 볼트 생성
    await homePage.createFile('test-indexeddb-persistence', true, TEST_PIN);
    await page.waitForLoadState('networkidle');

    // 2. 계정 여러 개 생성
    const accounts = [
      { title: 'GitHub Personal', url: 'https://github.com', username: 'devuser', password: 'GitHub123!', note: 'Personal GitHub' },
      { title: 'Gmail Work', url: 'https://gmail.com', username: 'work@company.com', password: 'Gmail456!', note: 'Work email' },
      { title: 'AWS Console', url: 'https://aws.amazon.com/console', username: 'awsadmin', password: 'AWS789!', note: 'AWS admin' },
    ];

    for (const account of accounts) {
      await createAccount(page, account);
    }

    // 계정 3개 확인
    await accountListPage.expectAccountCount(3);

    // 3. 브라우저 새로고침 (F5)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 4. /auth로 리다이렉트 확인 (암호화 볼트는 새로고침 시 잠김)
    await page.waitForURL('**/auth', { timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });

    // 5. PIN 입력 후 잠금 해제
    await page.fill('input[type="password"]', TEST_PIN);
    await page.getByRole('button', { name: '확인' }).click();
    await page.waitForURL('**/accounts', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 6. 계정 리스트가 로드될 때까지 대기 (플로팅 액션 버튼 확인)
    await accountListPage.addAccountButton.waitFor({ state: 'visible', timeout: 10000 });

    // 7. IndexedDB에서 데이터 확인 (PR 1 v15 model: 모든 vault 데이터는 db.files.fileData JSON에 snapshot으로 저장됨)
    const indexedDBInfo = await page.evaluate(async () => {
      return new Promise<{
        files?: Array<{ id: string; fileName: string; fileData: string; encrypted: boolean }>;
        dbVersion?: number;
        error?: string;
        stores?: string[];
      }>((resolve) => {
        // DB 이름이 "kiyo-db"로 고정됨 (src/database/db.ts:33)
        const dbName = 'kiyo-db';

        const request = indexedDB.open(dbName);
        request.onsuccess = (event: Event) => {
          const target = event.target as IDBOpenDBRequest | null;
          if (!target) {
            resolve({ error: 'no target' });
            return;
          }
          const db = target.result;
          if (!db.objectStoreNames.contains('files')) {
            resolve({ error: 'files store not found', stores: Array.from(db.objectStoreNames) });
            db.close();
            return;
          }
          const transaction = db.transaction(['files'], 'readonly');

          const filesStore = transaction.objectStore('files');

          const filesRequest = filesStore.getAll();

          new Promise<unknown>((resolve) => {
            filesRequest.onsuccess = () => resolve(filesRequest.result);
          })
            .then((files) => {
              resolve({ files: files as Array<{ id: string; fileName: string; fileData: string; encrypted: boolean }>, dbVersion: db.version });
              db.close();
            });
        };
        request.onerror = () => resolve({ error: request.error?.message ?? 'unknown' });
      });
    });

    // 8. 파일 메타데이터 확인
    expect(indexedDBInfo.files).toBeDefined();
    expect(Array.isArray(indexedDBInfo.files)).toBe(true);
    const files = indexedDBInfo.files!;
    expect(files.length).toBeGreaterThan(0);

    const activeFile = files.find(
      (f) => f.id === "test-indexeddb-persistence.json",
    );
    expect(activeFile).toBeDefined();
    const file = activeFile!;
    expect(file.fileName).toBe('test-indexeddb-persistence.json');
    expect(file.encrypted).toBe(true);

    // 9. v15: vault 데이터는 files.fileData에 암호화 JSON snapshot으로 저장됨.
    // cryptoKey 없이 직접 read 가능 (fileData 자체가 EncryptedKiyoVaultData JSON),
    // 단 accounts 필드는 ciphertext 보호 영역이라 길이/스키마 확인만 가능.
    expect(typeof file.fileData).toBe('string');
    const parsedSnapshot = JSON.parse(file.fileData);
    expect(parsedSnapshot.encrypted).toBe(true);
    expect(typeof parsedSnapshot.ciphertext).toBe('string');
    expect(parsedSnapshot.ciphertext.length).toBeGreaterThan(0);
  });
});