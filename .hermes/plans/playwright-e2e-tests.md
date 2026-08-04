# Playwright E2E Test Implementation Plan

## Overview
Add Playwright-based end-to-end tests for KIYO password manager web app (React + Vite). Tests will run in headless Chromium/Firefox/WebKit against the built application.

## Current State
- **Test Framework**: Vitest (unit/integration, jsdom)
- **E2E Tests**: None
- **Playwright**: Not installed
- **App**: React 19, Vite, Tailwind CSS 4, Capacitor 8

## Goals
Create 10 E2E test files covering core user flows:
1. Vault creation
2. PIN unlock (success/failure)
3. Account CRUD
4. Template CRUD
5. Create account from template
6. Manual lock / Auto lock
7. Import/Export (backup/restore)
8. Search
9. Password generator
10. Data persistence after reload

---

## Implementation Steps

### Phase 1: Setup & Configuration

#### 1.1 Install Playwright
```bash
npm install -D @playwright/test playwright
npx playwright install chromium  # 최소 Chromium만 설치 (CI 속도)
```

#### 1.2 Create Playwright Config
**File**: `playwright.config.ts` (project root)

```typescript
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',  // Vite dev server
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // storageState: undefined → localStorage/sessionStorage/cookies 격리
    // IndexedDB는 별도 fixture(indexeddb.fixture.ts)에서 관리
    storageState: undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 선택적: Firefox, WebKit 추가 가능
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

#### 1.3 Add NPM Scripts
**File**: `package.json` (scripts section)

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:all": "npm run check && npm run test:e2e"
  }
}
```

#### 1.4 Create E2E Directory Structure
```
e2e/
├── fixtures/
│   ├── test-data.ts           # 테스트용 공통 데이터/헬퍼
│   ├── auth.fixture.ts        # 인증 상태 픽스처 (볼트 생성/언락된 상태)
│   └── indexeddb.fixture.ts   # IndexedDB 격리 픽스처 + clearIndexedDB 헬퍼
├── pages/
│   ├── AuthPage.ts            # PIN 입력/생체인증 페이지
│   ├── HomePage.ts            # 계정 리스트 (Home)
│   ├── AccountDetailPage.ts   # 계정 상세
│   ├── AccountEditPage.ts     # 계정 생성/수정
│   ├── SettingsPage.ts        # 설정
│   ├── TemplateListPage.ts    # 템플릿 리스트
│   └── TemplateEditPage.ts    # 템플릿 생성/수정
├── utils/
│   ├── vault-helpers.ts       # 볼트 생성/열기/시드 헬퍼
│   ├── wait-helpers.ts        # 대기 유틸리티
│   ├── indexeddb.ts           # IndexedDB 초기화 헬퍼 (clearIndexedDB)
│   ├── test-clock.ts          # Auto-lock 시간 제어 (triggerVisibilityChange 등)
│   └── download.ts            # Export/Import 파일 처리
└── *.spec.ts                  # 10개 테스트 파일
```

---

### Phase 2: Page Object Models (POM)

각 페이지별로 상호작용을 캡슐화한 Page Object 생성

#### 2.1 AuthPage.ts
- `goto()` - 인증 페이지로 이동
- `createPin(pin: string)` - 최초 PIN 설정
- `unlockWithPin(pin: string)` - PIN으로 잠금 해제
- `expectError(message: string)` - 에러 메시지 검증
- `expectLocked()` - 잠금 상태 검증

#### 2.2 HomePage.ts
- `goto()` - 홈으로 이동
- `createAccount(data)` - 계정 생성 버튼 클릭 → 편집 페이지로
- `clickAccount(name: string)` - 계정 클릭 → 상세 페이지로
- `search(query: string)` - 검색 입력
- `getAccountNames()` - 표시된 계정 이름들 반환
- `clickSettings()` - 설정 페이지로
- `clickLock()` - 수동 잠금
- `expectAccountCount(count: number)`

#### 2.3 AccountEditPage.ts
- `fillForm(data)` - 폼 채우기 (이름, URL, 사용자명, 비밀번호, 노트, 즐겨찾기, 템플릿)
- `fillTemplateForm(templateName, fieldValues)` - 템플릿 선택 후 필드 값 입력
- `generatePassword(options)` - 비밀번호 생성기 열기/설정/적용
- `save()` - 저장
- `cancel()` - 취소
- `delete()` - 삭제 (모달 확인 포함)
- `selectTemplate(templateName: string)` - 템플릿 드롭다운에서 선택
- `getTemplateFields()` - 현재 선택된 템플릿의 필드 정의 반환
- `expectFieldValidation(fieldName, expectedError)` - 필드 유효성 검사 에러 메시지 확인

#### 2.4 SettingsPage.ts
- `setAutoLock(option: 'none' | '1m' | '10m' | '30m')` - 자동 잠금 설정
- `toggleBiometric(enabled: boolean)` - 생체인증 토글
- `exportVault()` - 백업 내보내기
- `importVault(file)` - 백업 가져오기
- `changePin(oldPin, newPin)` - PIN 변경

#### 2.5 TemplateListPage.ts
- `goto()` - 템플릿 리스트 페이지로 이동 (설정 → 템플릿 관리)
- `createTemplate(data)` - 템플릿 생성 버튼 클릭 → 편집 페이지로
- `clickTemplate(name: string)` - 템플릿 클릭 → 편집/상세 페이지로
- `deleteTemplate(name: string)` - 삭제 버튼 클릭 → 확인 모달 처리
- `getTemplateNames()` - 표시된 템플릿 이름들 반환
- `expectTemplateCount(count: number)`

#### 2.6 TemplateEditPage.ts
- `setName(name: string)` - 템플릿 이름 설정
- `addField(fieldDef)` - 필드 추가 (타입, 라벨, 필수여부, 기본값, 플레이스홀더)
- `updateField(index, fieldDef)` - 필드 수정
- `deleteField(index)` - 필드 삭제
- `moveFieldUp(index)` / `moveFieldDown(index)` - 필드 순서 변경
- `getFields()` - 현재 필드 목록 반환
- `save()` - 저장
- `cancel()` - 취소
- `expectFieldCount(count: number)`
- `expectFieldAt(index, expectedFieldDef)` - 특정 위치 필드 검증

---

### Phase 3: Test Files Implementation

#### 3.1 01-create-vault.spec.ts
```typescript
// 시나리오:
// 1. 최초 실행 시 볼트 생성 화면 표시
// 2. PIN 설정 (최소 4자리)
// 3. PIN 확인 일치 시 볼트 생성 완료
// 4. 홈 화면으로 리다이렉트
// 5. 빈 계정 리스트 표시
```

#### 3.2 02-unlock.spec.ts
```typescript
// 시나리오 - PIN unlock:
// 1. 기존 볼트 열기 (PIN 입력)
// 2. 올바른 PIN → 홈 화면 진입
// 
// 시나리오 - Wrong PIN:
// 1. 잘못된 PIN 입력
// 2. 에러 메시지 표시 ("PIN이 일치하지 않습니다")
// 3. 잠금 상태 유지
// 4. 5회 실패 시 지연/잠금 (있는 경우)
```

#### 3.3 03-account-crud.spec.ts
```typescript
// 시나리오 - Create:
// 1. 계정 생성 버튼 클릭
// 2. 필수 필드 입력 (이름, URL, 사용자명, 비밀번호)
// 3. 저장 → 리스트에 표시됨
//
// 시나리오 - Read:
// 1. 계정 클릭 → 상세 페이지
// 2. 모든 필드 값 확인
// 3. 비밀번호 표시/숨기기 토글
//
// 시나리오 - Update:
// 1. 계정 상세에서 편집 클릭
// 2. 필드 수정 후 저장
// 3. 변경사항 반영 확인
//
// 시나리오 - Delete:
// 1. 편집 화면에서 삭제 버튼
// 2. 확인 모달에서 "삭제" 클릭
// 3. 리스트에서 사라짐 확인
```

#### 3.4 04-template-crud.spec.ts
```typescript
// 시나리오 - Create Template:
// 1. 템플릿 리스트 페이지 이동 (설정 → 템플릿 관리)
// 2. "템플릿 추가" 클릭
// 3. 템플릿 이름 입력 (예: "신용카드", "서버 접속")
// 4. 필드 추가: 타입 선택 (텍스트, 비밀번호, URL, 이메일, 숫자, 날짜, 메모 등)
// 5. 필드 속성 설정: 라벨, 필수여부, 기본값, 플레이스홀더
// 6. 필드 순서 변경 (드래그 앤 드롭 또는 위/아래 버튼)
// 7. 저장 → 템플릿 리스트에 표시됨
//
// 시나리오 - Read Template:
// 1. 템플릿 클릭 → 상세 보기
// 2. 모든 필드 정의 확인 (타입, 라벨, 필수, 순서)
//
// 시나리오 - Update Template:
// 1. 템플릿 편집 모드 진입
// 2. 필드 추가/삭제/수정
// 3. 필드 순서 변경
// 4. 저장 → 변경사항 반영 확인
//
// 시나리오 - Delete Template:
// 1. 템플릿 리스트에서 삭제 버튼
// 2. 확인 모달에서 "삭제" 클릭
// 3. 리스트에서 사라짐 확인
// 4. 해당 템플릿 사용 중인 계정이 있는 경우 경고 표시 검증
```

#### 3.5 05-template-account.spec.ts
```typescript
// 시나리오 - Create Account from Template:
// 1. 템플릿 1개 이상 생성 (예: "신용카드": 카드번호, 만료일, CVC, 카드사)
// 2. 홈 화면에서 "계정 추가" 클릭
// 3. 템플릿 선택 드롭다운에서 "신용카드" 선택
// 4. 템플릿 기반 폼 자동 생성 확인:
//    - 템플릿에 정의된 필드들이 순서대로 표시
//    - 필수 필드에 * 표시
//    - 플레이스홀더 텍스트 표시
//    - 기본값이 있는 필드는 미리 채워짐
// 5. 필수 필드 모두 입력 후 저장
// 6. 계정 리스트에 정상 추가됨 확인
// 7. 계정 상세에서 템플릿 필드 값들 모두 확인
//
// 시나리오 - Validate Generated Form:
// 1. 다양한 필드 타입이 포함된 템플릿 생성:
//    - 텍스트 (일반 입력)
//    - 비밀번호 (마스킹, 표시/숨기기 토글)
//    - URL (링크 아이콘, 유효성 검사)
//    - 이메일 (이메일 형식 검증)
//    - 숫자 (숫자만 입력, 스피너)
//    - 날짜 (데이트 피커)
//    - 메모 (여러 줄 텍스트 영역)
// 2. 템플릿으로 계정 생성 시 각 필드 타입별 UI 렌더링 검증
// 3. 필수 필드 미입력 시 저장 불가/경고 표시 검증
// 4. 필드 타입별 유효성 검사 동작 확인 (이메일 형식, URL 형식 등)
//
// 시나리오 - Save Account from Template:
// 1. 템플릿 선택 후 모든 필드 입력
// 2. 저장 버튼 클릭
// 3. 계정 리스트에 표시 확인
// 4. 계정 상세 진입 시 템플릿 필드 값 그대로 저장되었는지 검증
// 5. 템플릿 변경 후 기존 계정은 영향 없음 확인 (템플릿은 생성 시점 스냅샷)
```

#### 3.6 06-lock.spec.ts
```typescript
// 시나리오 - Manual Lock:
// 1. 홈 화면에서 잠금 버튼 클릭
// 2. 인증 페이지로 이동
// 3. PIN 입력 후 다시 진입 가능
//
// 시나리오 - Auto Lock:
// 1. 설정에서 자동 잠금 "1분" 설정
// 2. 앱 비활성화 (탭 전환 또는 백그라운드)
// 3. 1분 경과 후 다시 포커스 시 잠금 화면 표시
// 4. 활동 감지 시 타이머 리셋 검증
```

#### 3.7 07-import-export.spec.ts
```typescript
// 시나리오 - Export (Backup):
// 1. 계정 여러 개 생성
// 2. 설정 → 백업 내보내기
// 3. 파일 다운로드/저장 확인 (.kiyo 확장자)
// 4. 파일 내용 검증 (암호화된 JSON)
//
// 시나리오 - Import (Restore):
// 1. 기존 볼트 잠금/삭제
// 2. 백업 파일 선택하여 가져오기
// 3. PIN 입력 (백업 시 PIN과 동일해야 함)
// 4. 모든 계정 복원 확인
```

#### 3.8 08-search.spec.ts
```typescript
// 시나리오:
// 1. 여러 계정 생성 (다양한 이름, URL, 사용자명)
// 2. 검색창에 키워드 입력
// 3. 실시간 필터링 확인 (이름, URL, 사용자명 매칭)
// 4. 빈 결과 시 "검색 결과 없음" 표시
// 5. 검색 초기화 (X 버튼 또는 ESC)
```

#### 3.9 09-password-generator.spec.ts
```typescript
// 시나리오:
// 1. 계정 생성/편집 페이지에서 비밀번호 생성기 열기
// 2. 길이 조절 (4~128)
// 3. 문자 종류 토글 (대문자, 소문자, 숫자, 특수문자)
// 4. "생성" 클릭 → 필드에 자동 입력
// 5. "복사" 버튼 동작 확인
// 6. 엔트로피/강도 표시 확인
```

#### 3.10 10-persistence.spec.ts
```typescript
// 시나리오:
// 1. 볼트 생성 + 계정 여러 개 추가
// 2. 브라우저 새로고침 (F5) 또는 페이지 재로드
// 3. PIN 입력 후 잠금 해제
// 4. 모든 계정 데이터 그대로 유지 확인
// 5. 설정(자동잠금, 테마 등) 유지 확인
// 6. IndexedDB 데이터 직접 검증 (선택적)
```

---

### Phase 4.5: Test Fixtures (인증 상태 & IndexedDB 격리)

Playwright의 **test fixtures**를 활용해 반복적인 설정(볼트 생성, PIN 언락, IndexedDB 정리)을 공통화합니다.

#### 4.5.1 auth.fixture.ts — 인증 상태 픽스처
```typescript
import { test as base, type Page } from '@playwright/test';
import { createTestVault, unlockVault, seedTestAccounts } from '../utils/vault-helpers';
import { clearIndexedDB } from '../fixtures/indexeddb.fixture';

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
  page: async ({ page }, use) => {
    await use(page);
  },

  // 볼트 생성 + 언락 완료된 페이지 (빈 볼트)
  authenticatedPage: async ({ page }, use) => {
    const pin = '1234';
    await createTestVault(page, pin);
    await use(page);
  },

  // 볼트 생성만 완료, PIN 입력 대기 상태
  vaultCreatedPage: async ({ page }, use) => {
    const pin = '1234';
    await createTestVault(page, pin);
    // 여기서 잠금 상태로 되돌리거나, createTestVault가 언락까지 하면 lockVault 호출
    await use(page);
  },

  // 완전히 깨끗한 상태 (IndexedDB, localStorage 모두 비워짐)
  freshPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    // 페이지 로드 후 IndexedDB 정리
    await page.goto('/');
    await clearIndexedDB(page);
    await use(page);
    await context.close();
  },

  // 테스트 데이터가 시드된 볼트 (언락된 상태)
  seededPage: async ({ page }, use) => {
    const pin = '1234';
    await createTestVault(page, pin);
    // 테스트 계정 데이터 시드
    await seedTestAccounts(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

#### 4.5.2 indexeddb.fixture.ts — IndexedDB 격리 픽스처
```typescript
import { test as base, type Page } from '@playwright/test';

/**
 * IndexedDB 완전 초기화 헬퍼
 * 
 * 주의: 앱 로드 후(페이지 네비게이션 후) 호출해야 함.
 * Vite/React 초기화 과정에서 DB connection을 먼저 잡을 수 있으므로
 * 페이지가 완전히 로드된 시점에서 정리하는 것이 안전.
 */
export async function clearIndexedDB(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();

    await Promise.all(
      databases.map(db =>
        new Promise<void>(resolve => {
          if (!db.name) {
            resolve();
            return;
          }
          const request = indexedDB.deleteDatabase(db.name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve(); // 에러 무시 (이미 삭제된 경우 등)
        })
      )
    );
  });
}

/**
 * IndexedDB 격리 픽스처
 * - 각 테스트 전/후 IndexedDB 완전 삭제
 * - auth.fixture.ts와 조합하여 사용
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    // 테스트 전: 앱 로드 후 IndexedDB 정리
    // (페이지가 이미 로드된 상태에서 호출되도록 테스트에서 await page.goto() 후 호출 권장)
    // 여기서는 안전장치로만 실행
    await clearIndexedDB(page);
    
    await use(page);
    
    // 테스트 후: 다시 정리 (다음 테스트 오염 방지)
    await clearIndexedDB(page);
  },
});
```

#### 4.5.3 테스트에서의 사용 예시
```typescript
// 03-account-crud.spec.ts
import { test, expect } from '../fixtures/auth.fixture';

// authenticatedPage 사용 - 이미 언락된 상태에서 시작
test('계정 생성', async ({ authenticatedPage }) => {
  const home = new HomePage(authenticatedPage);
  await home.createAccount({ name: 'Test', ... });
  await home.expectAccountCount(1);
});

// freshPage 사용 - 최초 볼트 생성 테스트
test('최초 볼트 생성', async ({ freshPage }) => {
  const auth = new AuthPage(freshPage);
  await auth.createPin('1234');
  // ...
});
```

#### 4.1 vault-helpers.ts
- `createTestVault(page, pin)` - 테스트용 볼트 생성 및 잠금 해제까지 수행
- `lockVault(page)` - 수동 잠금
- `unlockVault(page, pin)` - PIN으로 잠금 해제
- `seedTestAccounts(page)` - 테스트용 계정 데이터 시드 (GitHub, Gmail, AWS 등 3~5개 계정 생성)

#### 4.2 wait-helpers.ts
- `waitForNavigation(page, url)` - 네비게이션 대기
- `waitForToast(page, message)` - 토스트 메시지 대기
- `waitForIndexedDB(key, value)` - IndexedDB 데이터 대기

#### 4.3 indexeddb.ts
- `clearIndexedDB(page)` - IndexedDB 전체 삭제 (`indexedDB.databases()` + `deleteDatabase()`)

#### 4.4 test-clock.ts
- `triggerVisibilityChange(page, hidden: boolean)` - `visibilitychange` 이벤트 강제 발생
- `getLockState(page)` - 현재 자동잠금 상태 확인 (테스트용 훅 연동 시)

#### 4.5 download.ts
- `waitForDownload(page, trigger)` - 다운로드 이벤트 대기 및 파일 반환
- `saveDownload(download, path)` - 다운로드 파일 저장
- `uploadFile(page, selector, filePath)` - 파일 업로드 (input[type=file] 처리)
### Phase 5: CI/CD Integration

#### 5.1 GitHub Actions Workflow
**File**: `.github/workflows/e2e.yml`

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

---

## File Checklist

| Phase | File | Status |
|-------|------|--------|
| 1.1 | `package.json` (deps + scripts) | ⬜ |
| 1.2 | `playwright.config.ts` | ⬜ |
| 1.4 | `e2e/fixtures/test-data.ts` | ⬜ |
| 1.4 | `e2e/fixtures/auth.fixture.ts` | ⬜ |
| 1.4 | `e2e/fixtures/indexeddb.fixture.ts` | ⬜ |
| 2.1 | `e2e/pages/AuthPage.ts` | ⬜ |
| 2.2 | `e2e/pages/HomePage.ts` | ⬜ |
| 2.3 | `e2e/pages/AccountEditPage.ts` | ⬜ |
| 2.4 | `e2e/pages/SettingsPage.ts` | ⬜ |
| 2.5 | `e2e/pages/TemplateListPage.ts` | ⬜ |
| 2.6 | `e2e/pages/TemplateEditPage.ts` | ⬜ |
| 3.1 | `e2e/01-create-vault.spec.ts` | ⬜ |
| 3.2 | `e2e/02-unlock.spec.ts` | ⬜ |
| 3.3 | `e2e/03-account-crud.spec.ts` | ⬜ |
| 3.4 | `e2e/04-template-crud.spec.ts` | ⬜ |
| 3.5 | `e2e/05-template-account.spec.ts` | ⬜ |
| 3.6 | `e2e/06-lock.spec.ts` | ⬜ |
| 3.7 | `e2e/07-import-export.spec.ts` | ⬜ |
| 3.8 | `e2e/08-search.spec.ts` | ⬜ |
| 3.9 | `e2e/09-password-generator.spec.ts` | ⬜ |
| 3.10 | `e2e/10-persistence.spec.ts` | ⬜ |
| 4.1 | `e2e/utils/vault-helpers.ts` | ⬜ |
| 4.2 | `e2e/utils/wait-helpers.ts` | ⬜ |
| 4.3 | `e2e/utils/indexeddb.ts` | ⬜ |
| 4.4 | `e2e/utils/test-clock.ts` | ⬜ |
| 4.5 | `e2e/utils/download.ts` | ⬜ |
| 5.1 | `.github/workflows/e2e.yml` | ⬜ |

---

## Key Considerations

### Test Isolation
- 각 테스트는 독립적으로 실행되어야 함
- **Playwright Fixtures**로 인증 상태/IndexedDB 격리 관리 (`auth.fixture.ts`, `indexeddb.fixture.ts`)
- `test.beforeEach`에서 볼트 생성/정리 수행
- `test.afterEach`에서 스토리지 정리 (IndexedDB, localStorage)
- **`storageState: undefined`** 설정으로 **localStorage/sessionStorage/cookies** 격리 보장
- **IndexedDB는 `storageState` 대상이 아님** — 별도 `indexeddb.fixture.ts`에서 관리

### IndexedDB Isolation
- `storageState: undefined` → localStorage/sessionStorage/cookies 격리
- **IndexedDB 격리** → `indexeddb.fixture.ts`의 `clearIndexedDB()`로 별도 관리
- 각 테스트마다 **새로운 브라우저 컨텍스트** 사용 (`browser.newContext({ storageState: undefined })`)
- 테스트 전/후 `indexedDB.databases()`로 전체 DB 열거 후 `deleteDatabase()`로 완전 삭제
- **중요**: 앱 로드 후(페이지 네비게이션 후) `clearIndexedDB()` 호출 — Vite/React 초기화 과정에서 DB connection을 먼저 잡을 수 있으므로
- `fake-indexeddb`가 아닌 **실제 브라우저 IndexedDB** 사용 (Playwright는 실제 브라우저 실행)
- Dexie.js 스키마 변경 시 테스트 간 영향 차단

### Capacitor Plugins Mocking
- E2E 테스트는 웹 환경에서 실행 → 네이티브 플러그인 모킹 필요
- `common.setup.ts`의 모킹 전략 재사용 가능
- Playwright에서 `page.addInitScript`로 모킹 주입

### Async Operations
- 암호화/복호화, IndexedDB 작업은 비동기
- `waitForSelector`, `waitForResponse` 등으로 적절히 대기
- 애니메이션/트랜지션 완료 대기 고려

### Auto-lock Testing (Clock Injection 전략 — 권장)
**핵심 원칙**: 프로덕션 코드에 테스트용 분기 최소화, 실제 로직 검증

#### 앱 코드 수정 (최소한)
```typescript
// src/hooks/useAutoLock.ts 또는 전역 설정 파일
export const getAutoLockTimeout = () => 
  import.meta.env.VITE_E2E ? 100 : 60000;  // 1분 → 100ms
```

#### E2E 테스트에서
```bash
# .env.e2e 또는 playwright.config.ts의 env 설정
VITE_E2E=true npm run dev
```

#### 테스트 시나리오
1. **실제 timeout 로직 검증** — 단축된 시간(100ms) 후 자동 잠금 발생 확인
2. **실제 visibility 이벤트 검증** — `triggerVisibilityChange(page, true)`로 백그라운드 전환 시 타이머 동작 확인
3. **활동 감지 시 타이머 리셋** — 마우스/키보드 이벤트 후 타이머 재시작 확인

#### 왜 이 방식인가?
| 방식 | 문제점 |
|------|--------|
| `page.evaluate`로 상수 패치 | 번들된 React 코드에서 이미 값 인라인됨, HMR 의존, CI 불안정 |
| `vi.useFakeTimers` | 브라우저 컨텍스트 외부, Playwright와 호환 안 됨 |
| `window.__KIYO_TEST__` 노출 | 프로덕션 번들 오염 위험, `import.meta.env.DEV` 가드 필요 |

**Clock Injection (`VITE_E2E`)** 이 가장 안정적:
- 빌드 타임에 값 결정 → 번들에 박힘 → 런타임 패치 불필요
- 실제 `setTimeout`/`setInterval` 경로 그대로 실행
- CI/로컬/개발서버 모두 동일하게 동작

#### 개발용 헬퍼 (선택적)
```typescript
// src/utils/test-helpers.ts (VITE_E2E=true일 때만 번들 포함)
if (import.meta.env.VITE_E2E) {
  (window as any).__KIYO_TEST__ = {
    tickAutoLock: () => { /* 내부 타이머 1틱 강제 진행 */ },
    getLockState: () => { /* 현재 잠금 상태 반환 */ },
  };
}
```

### File Download/Upload
- Export: `page.waitForEvent('download')` 사용
- Import: `page.setInputFiles('input[type=file]', path)` 사용

---

## Execution Commands

```bash
# 설치 및 초기 설정
npm install -D @playwright/test playwright
npx playwright install chromium

# 개발 중 테스트 실행 (헤드리스)
npm run test:e2e

# UI 모드로 디버깅
npm run test:e2e:ui

# 헤드드 모드로 시각적 확인
npm run test:e2e:headed

# 특정 테스트만 실행
npx playwright test e2e/01-create-vault.spec.ts

# 디버그 모드 (브레이크포인트)
npm run test:e2e:debug
```

---

## Next Steps
1. 이 계획 승인 후 Phase 1부터 순차 구현
2. 각 Phase 완료 시 `npm run test:e2e`로 검증
3. 모든 테스트 통과 후 CI 워크플로우 추가