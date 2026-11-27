# Plan: AccountList 빈 상태(Empty State) 안내 구현

## Goal

볼트에 계정이 없거나 검색 결과가 없을 때 `AccountList`(`src/pages/Accounts/index.tsx`)에 명시적 빈 상태 안내("계정이 없습니다" / "검색 결과가 없습니다")와 해당 액션을 시작할 수 있는 버튼을 표시한다. (spec ui-ux FR-4.6, 현재 Out of Scope/미구현)

## Architecture

기존 `AccountList` 컴포넌트 내에 조건부 렌더링 분기를 추가하는 최소 수정 방식이다.

- `initialized === true`이고 `filteredAccounts.length === 0`인 경우:
  - `searchQuery`가 비어있으면: "계정이 없습니다" 안내 + "계정 추가" 버튼(템플릿 피커 열기)
  - `searchQuery`가 있으면: "검색 결과가 없습니다" 안내 + 검색 초기화/재검색 유도 안내
- 기존 계정 목록 렌더링(`<div className="grid gap-3">` 내 `filteredAccounts.map`)과 병존하도록, `filteredAccounts.length > 0`일 때만 목록을 렌더링하도록 감싼다.
- 스타일은 기존 `Templates/index.tsx`(템플릿 빈 상태) 패턴(중앙 정렬, `text-muted`, `rounded-2xl border`, `p-12 text-center`)과 `WebsiteSelector.tsx`(검색 결과 없음) 패턴을 재사용한다.
- 신규 컴포넌트/스토어/훅은 도입하지 않고, 기존 `Button`, `PageShell`만 사용한다.

## Tech Stack

- React 19, TypeScript (~6.0.2, strict, ESM only)
- Tailwind CSS 4 (기존 색상 토큰 `--color-text-muted`, `--color-border`, `--color-bg` 재사용)
- Zustand (`useAccountStore`, `useSessionStore`)
- Vitest + @testing-library/react (단위 테스트)
- `npm run typecheck`, `npm run lint`, `npm run test`로 검증

## Files

### Modify

- `src/pages/Accounts/index.tsx` — `AccountList` 컴포넌트에 빈 상태 섹션 2개 추가 (계정 없음 / 검색 결과 없음), 계정 목록 렌더링을 `filteredAccounts.length > 0`일 때만 수행
- `src/pages/Accounts/AccountList.test.tsx` — 빈 상태 케이스 테스트 2개 추가 (계정 없음, 검색 결과 없음)

### Create

- 없음 (기존 컴포넌트/유틸 재사용)

## Tasks

각 task는 2~5분 단위로 분해하며, 순차적 의존성을 가진다.

1. [ ] `src/pages/Accounts/index.tsx`: `initialized && filteredAccounts.length === 0 && !searchQuery.trim()` 시 "계정이 없습니다" 안내 + "계정 추가" 버튼(템플릿 피커 오픈) 섹션 추가
2. [ ] `src/pages/Accounts/index.tsx`: `initialized && filteredAccounts.length === 0 && searchQuery.trim()` 시 "검색 결과가 없습니다" 안내 섹션 추가
3. [ ] `src/pages/Accounts/index.tsx`: 기존 계정 목록 `<div className="grid gap-3">`를 `filteredAccounts.length > 0`일 때만 렌더링하도록 조건부 래핑
4. [ ] `src/pages/Accounts/AccountList.test.tsx`: `initialized=true` + `accounts=[]` + 검색 없음 → "계정이 없습니다" + 버튼 존재 테스트 추가
5. [ ] `src/pages/Accounts/AccountList.test.tsx`: `initialized=true` + `accounts=[]` + 검색어 입력 후 결과 없음 → "검색 결과가 없습니다" 테스트 추가
6. [ ] `npm run typecheck` 통과
7. [ ] `npm run lint` 통과 (수정 파일 기준)
8. [ ] `npm run test` 통과 (기존 행위 유지 + 신규 테스트 통과)

### 의존성 순서

Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

## Tests / Validation

- `npm run typecheck` — TypeScript 컴파일 오류 없음 (`@/` → `src/`, strict 모드 준수)
- `npm run lint` — `src/pages/Accounts/index.tsx`, `src/pages/Accounts/AccountList.test.tsx`에 새로운 lint 오류 없음
- `npm run test` — Vitest 단위 테스트 모두 통과 (기존 AccountList 테스트 3개 + 신규 2개 = 5개)
- 예상 출력: `Test Files  ... passed` (AccountList.test.tsx 포함), 모든 테스트 통과

## Risks / Tradeoffs / Open Questions

- **Tradeoff**: 신규 EmptyState 컴포넌트를 분리하지 않고 AccountList 내에 인라인으로 구현. 중복이 늘어날 수 있으나, spec-kit 철학(미니멀 수정)에 따라 우선 구현하고 추후 컴포넌트 분리 검토.
- **Open Question**: "계정 추가" 버튼의 액션 — 현재 FAB가 `TemplatePicker`를 열고 템플릿 선택 후 `/accounts/new`로 이동하는 흐름과 일치시킬지, 빈 상태 버튼은 바로 `/accounts/new`로 이동시킬지 미정. (권장: 기존 FAB과 동일하게 `TemplatePicker` 오픈)
- **Open Question**: "검색 결과가 없습니다" 상태에서 제공할 버튼 — "검색 초기화" 버튼만 둘지, 텍스트 안내만 둘지 미정. (권장: 검색어 초기화 버튼 + "다른 키워드로 검색해보세요" 안내 텍스트)
- **Risk**: `filteredAccounts`가 빈 배열일 때 기존 목록 렌더링을 조건부로 감싸면서 `My accounts` 헤더는 유지해야 함 — 헤더는 빈 상태와 관계없이 항상 표시.
