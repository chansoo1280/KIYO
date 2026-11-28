# Specification: 인터페이스 컴포넌트 및 레이아웃 요구사항

## Goal

KIYO React 앱(WebView)의 모든 페이지와 공유 컴포넌트가 일관된 헤더 패턴과 의미론적 HTML을 사용하고, 키보드 전용 사용자도 전체 인터페이스를 조작할 수 있도록 한다.

## Context / Assumptions

### 현재 상태 (Current State)

| 항목 | 현황 | 소스 |
|------|------|------|
| 공유 컴포넌트 | `Button`, `SettingsRow`, `BackButton`, `PageHeader`, `PageShell`, `BottomTabs`, `PresetIcon`, `DeleteButton` 존재 | `src/components/*.tsx` |
| 페이지 헤더 패턴 | 페이지별로 상이. `PageHeader` 적용: Templates, Settings, TemplateEdit, AccountEdit, AccountDetail. 미적용(인라인 헤더): Home, CreateVault, Auth, AutofillTestLogin, Accounts | 코드 정독 결과 |
| 뒤로 가기 버튼 | `BackButton` 컴포넌트 존재. CreateVault는 `BackButton` 직접 사용, Auth는 `Button`+`ArrowLeft`로 구현 | `src/components/BackButton.tsx`, `src/pages/Auth.tsx` |
| 삭제 버튼 | `DeleteButton` 컴포넌트 존재. Home은 인라인 스타일 사용 | `src/components/DeleteButton.tsx`, `src/pages/Home.tsx` |
| 커스텀 토글 | `AutofillSection`, `UISection`이 `<button role="switch">`로 구현. 키보드 Enter/Space 핸들러 없음 | `src/pages/Settings/components/AutofillSection.tsx`, `src/pages/Settings/components/UISection.tsx` |
| 포커스 링 | `Button.tsx`가 `focus:outline-none focus:ring-2` 사용. `focus-visible` 미사용 | `src/components/Button.tsx:47` |
| 파일명 표시 | `Auth.tsx`에서 `truncate` 클래스로 파일명 줄임. 전체 값 노출 수단 없음 | `src/pages/Auth.tsx:201-203` |
| 커스텀 버튼 역할 | `Accounts/index.tsx`에서 `<article role="button" tabIndex={0}>` 사용 | `src/pages/Accounts/index.tsx:285-293` |
| 링크를 버튼 모양으로 | `Home.tsx`에서 `<Link>`를 버튼 스타일로 스타일링 | `src/pages/Home.tsx:153-159` |

### 전제 조건 (Assumptions)

1. 타겟 플랫폼은 Android (API 26+) WebView 기반 Capacitor 앱이다.
2. 모든 데이터는 기기 로컬에만 저장되며, 네트워크 호출은 전혀 발생하지 않는다.
3. React 19 + TypeScript + Tailwind CSS 4 + React Router 7을 사용한다.
4. 아이콘은 `lucide-react`를 사용한다.
5. 색상 토큰은 `var(--color-*)` CSS 변수를 사용한다.

## Functional Requirements

### FR-1: 페이지 헤더 패턴 통일

#### FR-1.1: PageHeader 공유 컴포넌트 사용

**Given** 페이지에 제목과 뒤로 가기/액션이 필요한 헤더가 있다  
**When** 해당 페이지를 렌더링한다  
**Then** 인라인 `<header>` 대신 `PageHeader` 컴포넌트를 사용한다.  
**Then** `title` prop으로 제목을 표시하고, `leftActions` 슬롯에 `BackButton`을 배치하며, `actions` 슬롯에 우측 버튼을 배치한다.

#### FR-1.2: BackButton 재사용

**Given** 페이지에 뒤로 가기 기능이 필요하다  
**When** 뒤로 가기 버튼을 렌더링한다  
**Then** `Button`+`ArrowLeft` 인라인 조합 대신 `BackButton` 컴포넌트를 사용한다.  
**Then** `ariaLabel` prop으로 라벨을 오버라이드할 수 있다.

#### FR-1.3: Home 페이지 예외 유지

**Given** Home 페이지는 KIYO 로고 + eyebrow 패턴을 가진 독자적 헤더 디자인을 가진다  
**When** Home 페이지를 렌더링한다  
**Then** `PageHeader` 적용을 면제한다(Plan-G2 예외). 인라인 헤더를 유지한다.

### FR-2: 키보드 전용 조작 가능성

#### FR-2.1: 커스텀 토글 키보드 접근성

**Given** `AutofillSection` 또는 `UISection`의 토글 버튼에 포커스가 있다  
**When** 사용자가 Enter 또는 Space 키를 누른다  
**Then** 토글 상태가 전환되어야 한다.  
**Then** 마우스 클릭뿐만 아니라 키보드로도 조작할 수 있어야 한다.

#### FR-2.2: 포커스 표시

**Given** 인터랙티브 요소에 포커스가 있다  
**When** 키보드(Tab 등)로 포커스를 이동한다  
**Then`focus-visible` 기반 포커스 링이 표시되어야 하며, 마우스 클릭 시에는 불필요한 포커스 링이 노출되지 않아야 한다.

### FR-3: 의미론적 HTML 요소 사용

#### FR-3.1: 커스텀 역할 요소 교체

**Given** `<article role="button" tabIndex={0}>`와 같은 커스텀 버튼 역할 요소가 있다  
**When** 해당 요소를 렌더링한다  
**Then** 네이티브 `<button>` 요소로 교체하고 `role`/`tabIndex`/`onKeyDown` 커스텀 핸들러를 제거한다.

#### FR-3.2: 링크와 버튼 의미론 분리

**Given** 페이지 이동을 위한 `<Link>` 요소가 버튼 모양으로 스타일링되어 있다  
**When** 해당 요소를 렌더링한다  
**Then** `<Link>`는 링크로서 의미론을 유지하고, 버튼 동작이 필요한 경우 `<button>` 또는 `<Button asChild>`를 사용한다.

### FR-4: 파일명 전체 값 노출

#### FR-4.1: 줄임된 파일명 에스컬레이션

**Given** 파일명이 UI에서 `truncate`로 줄여서 표시된다  
**When** 사용자가 줄임된 파일명을 본다  
**Then** 툴팁, `title` 속성, Details 뷰 등 중 하나 이상의 방법으로 전체 값을 노출할 수단을 제공해야 한다.

### FR-5: 삭제 버튼 컴포넌트 재사용

#### FR-5.1: DeleteButton 사용

**Given** 목록 항목에 삭제 버튼이 필요하다  
**When** 삭제 버튼을 렌더링한다  
**Then** 인라인 파괴적 스타일(`hover:!bg-[var(--color-destructive-bg)]` 등) 대신 `DeleteButton` 컴포넌트를 사용한다.

## Non-Functional Requirements

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **접근성** | 모든 인터랙티브 요소에 키보드 조작 가능 및 포커스 표시 제공 | 코드 리뷰, 스크린 리더 테스트, axe-core 접근성 검사 |
| **접근성** | 모든 인터랙티브 요소에 접근성 이름(`aria-label` 또는 텍스트 콘텐츠) 제공 | 스크린 리더 테스트 |
| **의미론** | `<button>`은 `<button>` 태그, `<a>`/`<Link>`는 링크 태그로 사용 | DOM 코드 리뷰 |
| **일관성** | 페이지 헤더는 `PageHeader` 컴포넌트 사용 (Home 예외) | 코드 리뷰, 스크린샷 비교 |
| **타입 안정성** | TypeScript strict 플래그 준수 (`noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`) | `npm run typecheck` |
| **린트/테스트** | `npm run typecheck`, `npm run lint`, `npm run test` 모두 통과 | CI 검증 |

## Out of Scope (명시적 제외)

다음 항목은 본 인터페이스 스펙의 범위에 포함하지 않는다. 실제 구현이 존재하더라도 '나중에 구현 예정'으로 명시한다.

1. **애니메이션 세부사항**: 페이드인/아웃, 슬라이드 등 모션 디테일은 별도 디자인 스펙.
2. **다크/라이트 테마 구체적 컬러 값**: 테마 구조는 `settings` 스펙 참조, 구체적 토큰 값은 디자인 시스템.
3. **Android 네이티브 UI (Kotlin/View)**: 본 스펙은 React/WebView 측 UI에 집중. 네이티브 오버레이·생체인증 다이얼로그는 `android-security` 스펙 참조.
4. **온보딩/튜토리얼 화면**: 최초 실행 시 안내 흐름은 별도 스펙.
5. **클라우드 동기화 UI**: 모든 데이터는 기기 로컬에만 저장되므로 동기화 관련 UI는 제외.

## Acceptance Criteria

이 spec이 완료됐다고 판단할 조건:

1. **AC-1**: `PageHeader` 미적용 페이지(CreateVault, Auth, AutofillTestLogin, Accounts)가 `PageHeader`로 마이그레이션된다. Home은 예외 유지.
2. **AC-2**: `BackButton` 미사용 페이지(Auth)가 `BackButton` 컴포넌트를 재사용한다.
3. **AC-3**: 커스텀 토글(`AutofillSection`, `UISection`)에 Enter/Space 키 핸들러가 추가되어 키보드 조작이 가능하다.
4. **AC-4**: `Button.tsx`가 `focus-visible`을 사용하여 마우스 클릭 시 불필요한 포커스 링이 노출되지 않는다.
5. **AC-5**: `Accounts/index.tsx`의 `<article role="button">`이 네이티브 `<button>`으로 교체된다.
6. **AC-6**: `Home.tsx`의 `<Link>` 버튼 스타일링이 의미론적으로 올바른 요소로 교체되거나 `<Button asChild>`로 변경된다.
7. **AC-7**: `Auth.tsx`의 줄임된 파일명에 전체 값 노출 수단(툴팁, `title` 속성, Details 뷰 중 하나 이상)이 추가된다.
8. **AC-8**: `Home.tsx`의 삭제 버튼이 `DeleteButton` 컴포넌트로 교체된다.
9. **AC-9**: `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과한다.

## Open Questions (미결정 사항 — 추측하지 않음)

| 항목 | 현황 |
|------|------|
| `AutofillSection` 토글을 네이티브 `<input type="checkbox">`로 교체할지, APG 스위치 키맵을 추가할지 | 미정 — 구현 단계에서 결정 |
| `Auth.tsx` 파일명 전체 값 노출을 툴팁으로 할지, `title` 속성으로 할지, Details 뷰로 할지 | 미정 — 구현 단계에서 결정 |
| `Home.tsx`의 `<Link>`를 `<Button asChild>`로 변경할지, 네이티브 링크 스타일을 유지할지 | 미정 — 구현 단계에서 결정 |

## 참고 문서

- `CONSTITUTION.md` — 프로젝트 헌법, 보안 규칙 및 코딩 표준
- `.hermes/specs/ui-ux/specification.md` — UI/UX 요구사항 (상태 안내, 로딩/실패/비활성화). 본 스펙과 상호 보완.
- `.hermes/specs/account-crud/specification.md` — 계정 CRUD 요구사항
- `.hermes/specs/template-crud/specification.md` — 템플릿 CRUD 요구사항
- `src/components/PageHeader.tsx` — 페이지 헤더 공유 컴포넌트 (Plan-G2)
- `src/components/BackButton.tsx` — 뒤로 가기 버튼 공유 컴포넌트
- `src/components/DeleteButton.tsx` — 삭제 버튼 공유 컴포넌트
- `src/components/Button.tsx` — 범용 버튼 컴포넌트
- `.hermes/reviews/interface-review-2026-11-27.md` — 인터페이스 리뷰 보고서 (본 스펙의 입력 소스)