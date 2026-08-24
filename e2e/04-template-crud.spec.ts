import { test, expect } from '@playwright/test';
import { clearIndexedDB } from './fixtures/indexeddb.fixture';
import { TEST_PIN } from './fixtures/test-data';
import { HomePage, AccountListPage } from './pages/HomePage';
import { TemplateListPage, TemplateEditPage } from './pages/TemplatePages';

test.describe('템플릿 CRUD (Template CRUD)', () => {
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
    await homePage.createFile('test-template-crud', true, TEST_PIN);
  });

  test.describe('템플릿 생성 (Create Template)', () => {
    test('템플릿 리스트 페이지 이동 → 템플릿 생성 → 저장 → 리스트에 표시', async () => {
      // 설정 → 템플릿 관리 페이지로 이동
      await accountListPage.clickSettings();
      await templateListPage.goto();

      // 기본 템플릿 6개 확인
      await templateListPage.expectTemplateCount(6);

      // 템플릿 생성 페이지로 이동
      await templateListPage.createTemplate();

      // 템플릿 정보 입력
      await templateEditPage.setName('신용카드');
      await templateEditPage.setDescription('카드번호, 만료일, CVC, 카드사');

      // 첫 번째 필드 추가 (빈 템플릿으로 시작하므로 addField 사용)
      await templateEditPage.addField({
        type: 'text',
        label: '카드번호',
      });

      // 필드 추가: 만료일 (텍스트)
      await templateEditPage.addField({
        type: 'text',
        label: '만료일',
      });

      // 필드 추가: CVC (비밀번호)
      await templateEditPage.addField({
        type: 'password',
        label: 'CVC',
      });

      // 필드 추가: 카드사 (선택)
      await templateEditPage.addField({
        type: 'select',
        label: '카드사',
        options: ['Visa', 'Mastercard', 'Amex', 'JCB', '기타'],
      });

      // 저장
      await templateEditPage.save();

      // 템플릿 리스트에서 확인 (기본 6개 + 신규 1개 = 7개)
      await templateListPage.expectTemplateCount(7);
      const names = await templateListPage.getTemplateNames();
      expect(names).toContain('신용카드');
    });
  });

  test.describe('템플릿 조회 (Read Template)', () => {
    test.beforeEach(async () => {
      // 사전 준비: 템플릿 1개 생성
      await accountListPage.clickSettings();
      await templateListPage.goto();
      await templateListPage.createTemplate();
      await templateEditPage.setName('서버 접속');
      await templateEditPage.setDescription('SSH 접속 정보');
      // 첫 번째 빈 필드 채우기 (addField 사용)
      await templateEditPage.addField({ type: 'text', label: '호스트' });
      await templateEditPage.addField({ type: 'text', label: '포트' });
      await templateEditPage.addField({ type: 'text', label: '사용자명' });
      await templateEditPage.addField({ type: 'password', label: '비밀번호' });
      await templateEditPage.addField({ type: 'text', label: 'SSH 키 경로' });
      await templateEditPage.save();
      // save() 후 이미 /templates에 있으므로 추가 goto() 불필요 (cryptoKey 유지 위해)
    });

    test('템플릿 클릭 → 수정 페이지에서 모든 필드 정의 확인', async () => {
      await templateListPage.clickTemplate('서버 접속');

      // 필드 개수 및 내용 확인
      await templateEditPage.expectFieldCount(5);
      await templateEditPage.expectFieldAt(0, { label: '호스트', type: 'text' });
      await templateEditPage.expectFieldAt(1, { label: '포트', type: 'text' });
      await templateEditPage.expectFieldAt(2, { label: '사용자명', type: 'text' });
      await templateEditPage.expectFieldAt(3, { label: '비밀번호', type: 'password' });
      await templateEditPage.expectFieldAt(4, { label: 'SSH 키 경로', type: 'text' });

      // 기본 정보 확인
      await expect(templateEditPage.nameInput).toHaveValue('서버 접속');
      await expect(templateEditPage.descriptionInput).toHaveValue('SSH 접속 정보');

      // 취소하고 리스트로 돌아가기
      await templateEditPage.cancel();
      await templateListPage.expectTemplateCount(7);  // 기본 6개 + 생성한 1개
    });
  });

  test.describe('템플릿 수정 (Update Template)', () => {
    test.beforeEach(async () => {
      // 사전 준비: 템플릿 1개 생성
      await accountListPage.clickSettings();
      await templateListPage.goto();
      await templateListPage.createTemplate();
      await templateEditPage.setName('기존 템플릿');
      // 빈 템플릿에서 필드 추가
      await templateEditPage.addField({ type: 'text', label: '필드1' });
      await templateEditPage.addField({ type: 'text', label: '필드2' });
      await templateEditPage.save();
      // save() 후 이미 /templates에 있으므로 추가 goto() 불필요
    });

    test('템플릿 편집 모드 진입 → 필드 추가/삭제/수정 → 저장 → 변경사항 반영 확인', async () => {
      await templateListPage.clickTemplate('기존 템플릿');

      // 필드 3번째 추가
      await templateEditPage.addField({ type: 'email', label: '이메일' });
      await templateEditPage.expectFieldCount(3);

      // 첫 번째 필드 라벨 수정
      await templateEditPage.updateField(0, { label: '수정된 필드1' });

      // 두 번째 필드 삭제
      await templateEditPage.deleteField(1); // 인덱스 1이었던 '필드2' 삭제
      await templateEditPage.expectFieldCount(2);

      // 저장
      await templateEditPage.save();

      // 리스트에서 확인 후 다시 들어가서 검증
      await templateListPage.clickTemplate('기존 템플릿');
      await templateEditPage.expectFieldCount(2);
      await templateEditPage.expectFieldAt(0, { label: '수정된 필드1', type: 'text' });
      await templateEditPage.expectFieldAt(1, { label: '이메일', type: 'email' });
    });
  });

  test.describe('템플릿 삭제 (Delete Template)', () => {
    test.beforeEach(async () => {
      // 사전 준비: 템플릿 1개 생성
      await accountListPage.clickSettings();
      await templateListPage.goto();
      await templateListPage.createTemplate();
      await templateEditPage.setName('삭제할 템플릿');
      // 빈 템플릿에서 필드 추가
      await templateEditPage.addField({ type: 'text', label: '필드' });
      await templateEditPage.save();
      // save() 후 이미 /templates에 있으므로 추가 goto() 불필요
    });

    test('템플릿 리스트에서 수정 진입 → 삭제 버튼 → 확인 모달에서 삭제 → 리스트에서 사라짐', async () => {
      await templateListPage.clickTemplate('삭제할 템플릿');
      await templateEditPage.delete();

      // 리스트에서 사라짐 확인 (기본 6개만 남음)
      await templateListPage.expectTemplateCount(6);
    });
  });
});