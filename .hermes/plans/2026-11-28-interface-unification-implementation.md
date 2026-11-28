# Plan: 인터페이스 컴포넌트 및 레이아웃 통일 (스펙 기반 구현)

**Date:** 2026-11-28  
**Branch:** `dev`  
**Specification:** `.hermes/specs/interface/specification.md`  
**Source Review:** `.hermes/reviews/interface-review-2026-11-27.md`  

## Goal

인터페이스 스펙의 AC-1~AC-8을 모두 구현하여, 페이지 헤더 패턴 통일, 키보드 전용 조작 가능성, 의미론적 HTML 요소 사용, 파일명 전체 값 노출, 삭제 버튼 컴포넌트 재사용을 완성한다.

## Architecture

기존 공유 컴포넌트(`PageHeader`, `BackButton`, `DeleteButton`, `Button`)를 그대로 재사용하며, 새로운 라이브러리나 스타일 시스템은 도입하지 않는다. 각 페이지의 인라인 헤더를 `PageHeader`로 교체하고, 커스텀 토글에 키보드 핸들러를 추가하며, `<article role="button">`을 `<button>`으로 교체한다. Home 페이지는 Plan-G2 예외로 유지한다.

## Tech Stack

React 19 + TypeScript + Tailwind CSS 4 + React Router 7, lucide-react, Vitest

## Files

| # | 파일 | 작업 |
|---|------|------|
| 1 | `src/pages/Settings/components/AutofillSection.tsx` | 커스텀 토글에 Enter/Space 키 핸들러 추가 |
| 2 | `src/pages/Settings/components/UISection.tsx` | 다크모드 토글에 Enter/Space 키 핸들러 추가 |
| 3 | `src/pages/Auth.tsx` | 줄임된 파일명에 전체 값 노출(`title` 속성) 추가 |
| 4 | `src/pages/CreateVault/index.tsx` | 인라인 헤더 → `PageHeader` + `BackButton` 마이그레이션 |
| 5 | `src/pages/Auth.tsx` | `Button`+`ArrowLeft` → `BackButton` 재사용 + `PageHeader` 적용 |
| 6 | `src/pages/Accounts/index.tsx` | `<article role="button">` → `<button>` 교체; 인라인 헤더 → `PageHeader` |
| 7 | `src/pages/Home.tsx` | `<Link>` 버튼 스타일링 수정; 삭제 버튼 → `DeleteButton`; `PageHeader` 적용 검토 |
| 8 | `src/components/Button.tsx` | `focus-visible` 적용 |
| 9 | `src/pages/AutofillTestLogin.tsx` | 인라인 헤더 → `PageHeader` 적용 검토 |

## Tasks

**Phase 1: HIGH (키보드 조작 차단 요인 — 먼저 처리)**

| # | Task | 파일 | 예상 소요 |
|---|------|------|-----------|
| 1.1 | `AutofillSection` 토글 버튼에 `onKeyDown` Enter/Space 핸들러 추가 | `src/pages/Settings/components/AutofillSection.tsx:214-233` | 3분 |
| 1.2 | `UISection` 다크모드 토글 버튼에 `onKeyDown` Enter/Space 핸들러 추가 | `src/pages/Settings/components/UISection.tsx:30-47` | 3분 |
| 1.3 | `Auth.tsx` 파일명 `truncate` 요소에 `title={fileName}` 추가 | `src/pages/Auth.tsx:201-203` | 2분 |

**Phase 2: MEDIUM (헤더 및 의미론 통일)**

| # | Task | 파일 | 예상 소요 |
|---|------|------|-----------|
| 2.1 | `CreateVault` 인라인 `<header>` → `PageHeader` + `leftActions`에 `BackButton` | `src/pages/CreateVault/index.tsx:80-92` | 5분 |
| 2.2 | `Auth.tsx` `Button`+`ArrowLeft` → `BackButton` 재사용 + `PageHeader` 적용 | `src/pages/Auth.tsx:162-183` | 5분 |
| 2.3 | `Accounts/index.tsx` `<article role="button">` → `<button>` 교체 | `src/pages/Accounts/index.tsx:285-293` | 3분 |
| 2.4 | `Accounts/index.tsx` 인라인 헤더 → `PageHeader` 마이그레이션, 검색/정렬 버튼을 `actions`에 | `src/pages/Accounts/index.tsx:160-213` | 5분 |
| 2.5 | `Home.tsx` `<Link>` 버튼 스타일링 → `<Button asChild>` 또는 링크 스타일 유지 | `src/pages/Home.tsx:153-159` | 3분 |
| 2.6 | `AutofillTestLogin.tsx` 인라인 헤더 → `PageHeader` 적용 검토 | `src/pages/AutofillTestLogin.tsx:19-31` | 3분 |

**Phase 3: LOW (디테일 수정)**

| # | Task | 파일 | 예상 소요 |
|---|------|------|-----------|
| 3.1 | `Button.tsx` `focus:outline-none focus:ring-2` → `focus-visible:` | `src/components/Button.tsx:47` | 2분 |
| 3.2 | `Home.tsx` 삭제 버튼 → `<DeleteButton>` 재사용 | `src/pages/Home.tsx:211-218` | 3분 |
| 3.3 | `Home.tsx` `PageHeader` 적용 검토 (Plan-G2 예외 유지 가능) | `src/pages/Home.tsx:128-139` | 2분 |

**Phase 4: 검증**

| # | Task | 명령어 | 예상 소요 |
|---|------|--------|-----------|
| 4.1 | TypeScript 타입 체크 | `npm run typecheck` | 1분 |
| 4.2 | ESLint 린트 | `npm run lint` | 1분 |
| 4.3 | Vitest 테스트 | `npm run test` | 1분 |

의존성: Phase 1 → Phase 2 → Phase 3 → Phase 4 순서로 실행. Phase 2.1~2.6은 서로 독립적이므로 순서는 자유로움.

## Tests / Validation

- `npm run typecheck` — `tsc -b --noEmit`, 에러 없음
- `npm run lint` — ESLint, 경고/에러 없음
- `npm run test` — Vitest (unit + typecheck), 모든 테스트 통과
- 기존 컴포넌트 테스트(`Button.test.tsx`, `PageHeader.test.tsx`, `DeleteButton.test.tsx` 등)이 여전히 통과해야 함

## Risks / Tradeoffs / Open Questions

- `AutofillSection` / `UISection` 토글을 네이티브 `<input type="checkbox">`로 교체할지, APG 스위치 키맵(Enter/Space)을 추가할지: 스펙 Open Questions에 미정으로 남음. 본 계획에서는 기존 `button role="switch"` 구조를 유지하고 키보드 핸들러만 추가하는 방향으로 진행.
- `Auth.tsx` 파일명 전체 값 노출을 `title` 속성으로 할지, 툴팁/Details 뷰로 할지: 본 계획에서는 `title` 속성으로 진행 (가장 단순, 스펙 AC-7 만족).
- `Home.tsx`의 `<Link>`를 `<Button asChild>`로 변경할지, 네이티브 링크 스타일을 유지할지: 스펙 Open Questions에 미정. 본 계획에서는 `<Button asChild>`로 변경하여 의미론을 맞춤.
- `Home.tsx`와 `AutofillTestLogin.tsx`의 `PageHeader` 적용은 Plan-G2 예외 / 단일 페이지 진입점 이유로 유지 가능. 본 계획에서는 적용 검토 후 적용 여부 결정.
