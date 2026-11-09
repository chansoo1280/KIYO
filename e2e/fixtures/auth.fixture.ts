import { test as base, type Page } from '@playwright/test';
import { createTestVault, seedTestAccounts, lockVault } from '../utils/vault-helpers';
import { clearIndexedDB } from './indexeddb.fixture';
import { TEST_PIN } from './test-data';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FixtureContext = any;

// 픽스처 타입 정의
interface AuthFixtures {
  // 이미 볼트가 생성되고 언락된 상태로 시작하는 페이지 (빈 볼트)
  authenticatedPage: Page;
  // 볼트만 생성된 상태 (PIN 입력 대기)
  vaultCreatedPage: Page;
  // PIN 설정용 페이지 (최초 실행 상태)
  freshPage: Page;
  // 테스트 데이터가 미리 채워진 볼트 (search/edit/delete 테스트용)
  seededPage: Page;
}

export const test = base.extend<AuthFixtures>({
  // 기본 페이지: 각 테스트마다 새 컨텍스트/페이지 (storageState: undefined로 격리)
  page: async ({ page }: FixtureContext, cb: (page: Page) => Promise<void>) => {
    await cb(page);
  },

  // 볼트 생성 + 언락 완료된 페이지 (빈 볼트)
  authenticatedPage: async ({ page }: FixtureContext, cb: (page: Page) => Promise<void>) => {
    const pin = TEST_PIN;
    await createTestVault(page, pin);
    await cb(page);
  },

  // 볼트 생성만 완료, PIN 입력 대기 상태
  vaultCreatedPage: async ({ page }: FixtureContext, cb: (page: Page) => Promise<void>) => {
    const pin = TEST_PIN;
    await createTestVault(page, pin);
    // 여기서 잠금 상태로 되돌리기
    await lockVault(page);
    await cb(page);
  },

  // 완전히 깨끗한 상태 (IndexedDB, localStorage 모두 비워짐)
  freshPage: async ({ browser }: FixtureContext, cb: (page: Page) => Promise<void>) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    // 페이지 로드 후 IndexedDB 정리
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await clearIndexedDB(page);
    await cb(page);
    await context.close();
  },

  // 테스트 데이터가 시드된 볼트 (언락된 상태)
  seededPage: async ({ page }: FixtureContext, cb: (page: Page) => Promise<void>) => {
    const pin = TEST_PIN;
    await createTestVault(page, pin);
    // 테스트 계정 데이터 시드
    await seedTestAccounts(page);
    await cb(page);
  },
});

export { expect } from '@playwright/test';