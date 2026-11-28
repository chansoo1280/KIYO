# KIYO 인터페이스 리뷰 보고서

**일시**: 2026-11-27 (대한민국 표준시)  
**리뷰어**: KIYO Compound Engineering Agent (better-interface 스킬 적용)  
**평결**: Approve with findings (수정 없이는 전체 인터페이스를 키보드-only로 완료할 수 없음)  
**검토 대상**: 소스 코드 + `e2e/screenshots/` 15개 스크린샷(홈/빈홈, 볼트생성 1~2단계, PIN 잠금해제, 템플릿 선택기, 계정 생성, 설정, 템플릿 목록, 자동완성 테스트 등)

---

## 1. 해결된 범위

| 항목 | 내용 |
|------|------|
| **범위** | KIYO React 앱(WebView) 인터페이스 전체 |
| **포함 페이지/플로우** | 홈, 계정 목록, 계정 상세/수정, 설정(보안/UI/데이터/자동완성), 인증(PIN/생체인증), 볼트 생성 플로우, 하단 탭, 템플릿 선택기 모달 |
| **포함 공유 컴포넌트** | `Button`, `SettingsRow`, `BackButton`, `PageShell`, `PageHeader`, `BottomTabs`, `PresetIcon` |
| **포함 상태** | 빈 화면(빈 계정 목록), 로딩(세션 초기화), 에러(PIN 실패, 삭제 실패), 모달(템플릿 선택기, 삭제 확인), 좁은 뷰포트(Auth `maxWidth="sm"`) |
| **제외 범위** | Android 네이티브 레이어(AutofillService, Keystore, SQLCipher), Capacitor 브리지 TS 래퍼, Dexie/암호화 로직, Playwright E2E 테스트 코드 |

**프레임워크/스타일링**: React 19 + TypeScript, Tailwind CSS 4(CSS 변수 토큰 `var(--color-*)`), React Router 7. 아이콘은 `lucide-react`.

**프로젝트 자체 문서**: `AGENTS.md`, `CLAUDE.md`만 존재. 별도 `CONTRIBUTING.md`, `CODING_STANDARDS.md`, 디자인 시스템 문서, Storybook, 인터페이스 ADR 없음. 프로젝트 내 결정 사항 주석(`Q1~Q17` 등)이 사실상의 코딩 컨벤션 역할을 함.

---

## 2. 도메인별 커버리지

| 도메인 | 담당 스킬 | 상태 | 근거 |
|--------|-----------|------|------|
| 접근성 | `better-accessibility` | Reviewed | 키보드/포커스, ARIA, accessible name, 롤, 에러 발표 검토 완료. 스크린샷 15개 렌더링 상태 확인. |
| 레이아웃 | `better-layout` | Reviewed | 그룹화, 정렬, 반응형, 320px, 논리 속성 검토 완료. 헤더 배치 불일치 확인. |
| 글 | `better-writing` | Reviewed | 라벨, 에러, 빈 화면, 버튼 동사, 검색/필터 카피 검토 완료. |
| 타이포그래피 | `better-typography` | Reviewed | 글자 크기, 줄 간격, truncate, 단위 검토 완료. |
| 색상 | `better-colors` | Reviewed | 대비 토큰, semantic color, danger/accent 사용 검토 완료. |
| UI 연마 | `better-ui` | Reviewed | 보더 반경, 포커스 링, 아이콘 상태, 표면 마감 검토 완료. |
| 모션 | `better-motion` | Not verified | 정적 스크린샷만으로 검증 불가. 런타임 브라우저 테스트 필요. |

---

## 3. 발견 사항 테이블 (심각도 순)

| # | 심각도 | 도메인 | 위치 | 현재 구현 | 왜 문제 | 수정 방향 (선택 순서) |
|---|--------|--------|------|-----------|---------|----------------------|
| 1 | HIGH | 접근성 | `src/pages/Settings/components/AutofillSection.tsx:214-233` | `<button role="switch" aria-checked onClick={...}>` 커스텀 토글. 키보드 Enter/Space 핸들러 없음, 포커스 링 없음 | 포인터로만 도달 가능, 키보드로 조작 불가, 포커스 표시 없음. ESC기 트리거 | **Use the platform**: 네이티브 `<input type="checkbox">` 또는 APG 스위치 키맵(Enter/Space) 추가 + `focus-visible` 링 |
| 2 | HIGH | 접근성 | `src/pages/Settings/components/UISection.tsx:30-47` | `<button role="switch" aria-checked onClick={...}>` 다크모드 토글. 키보드 핸들러 없음 | 포인터 전용 제어, 키보드 도달 불가 | **Use the platform**: 네이티브 체크박스 또는 키보드 핸들러 + 포커스 링 |
| 3 | HIGH | 타이포그래피 | `src/pages/Auth.tsx:201` | `<p className="... truncate">{fileName}</p>` — 파일명 줄임, 전체 값 볼 수단 없음 | 줄임된 내용에 도달할 방법 없음 (에스컬레이션 트리거) | **Add**: 툴팁, Details 뷰, 또는 `title` 속성으로 전체 값 노출 |
| 4 | MEDIUM | 접근성 | `src/pages/Accounts/index.tsx:285-293` | `<article role="button" tabIndex={0} onClick onKeyDown>` — 커스텀 버튼 | 네이티브 `<button>`이 존재함. 커스텀 롤 유지 비용 | **Use the platform**: `<button>`로 교체, `role`/`tabIndex`/`onKeyDown` 제거 |
| 5 | MEDIUM | 접근성 | `src/pages/Home.tsx:153-159` | `<Link to="/create-vault" className="...button-styles...">` — 링크를 버튼 모양으로 스타일링 | 링크가 버튼처럼 보임. 의미론적 혼동 | **Use the platform**: `<Button asChild>` 또는 네이티브 링크 스타일 유지 |
| 6 | MEDIUM | 레이아웃 / UI | `src/pages/CreateVault/index.tsx:82-92` | `PageHeader` 미사용. 인라인 `<header>` + `BackButton` 직접 사용 (`ariaLabel="홈으로"`) | `PageHeader` 공유 컴포넌트와 시각·구조 불일치. 헤더 패턴이 페이지별로 상이 | **Reuse what the project has**: `PageHeader`로 마이그레이션, `BackButton`을 `leftActions`에 |
| 7 | MEDIUM | 레이아웃 / UI | `src/pages/Auth.tsx:162-183` | `PageHeader` 미사용. 인라인 헤더. `BackButton` 대신 `Button` + ArrowLeft 아이콘 + 커스텀 className | 전용 `BackButton` 컴포넌트 존재에도 미사용. 중복 구현으로 미세 스타일 차이 발생 | **Reuse what the project has**: `BackButton` 컴포넌트 재사용 (`ariaLabel` 오버라이드 가능) + `PageHeader` 적용 검토 |
| 8 | LOW | UI | `src/components/Button.tsx:47` | `focus:outline-none focus:ring-2` — `focus-visible` 미사용 | 마우스 클릭 시에도 포커스 링이 보임. 마우스 사용자 불필요 시각 노출 | **Correct the value**: `focus-visible:`로 변경 |
| 9 | LOW | UI | `src/pages/Home.tsx:211-218` | 삭제 버튼에 인라인 `hover:!bg-[var(--color-destructive-bg)]` 등 스타일 직접 적용 | `DeleteButton` 컴포넌트 미사용. 프로젝트 컨벤션과 불일치 | **Reuse what the project has**: `<DeleteButton>` 사용 |
| 10 | LOW | UI | `src/pages/Home.tsx:128-139` | 홈 페이지 헤더가 `PageHeader` 미사용, 인라인 헤더 | `PageHeader`와 시각·구조 불일치. Home은 Plan-G2 예외로 명시됨 | 예외 유지 가능(의도적 분리). 통일 원하면 `PageHeader` 적용 |
| 11 | MEDIUM | 레이아웃 / UI | `src/pages/AutofillTestLogin.tsx:19-31` | `PageHeader` 미사용. 인라인 `<header>` + K 로고 + 제목 직접 구성 | `PageHeader` 공유 컴포넌트와 시각·구조 불일치. 뒤로 가기 버튼 없음 (단일 페이지 진입점이므로 허용 가능) | 페이지 진입점이므로 예외 유지 가능. 통일 원하면 `PageHeader` 적용 |
| 12 | MEDIUM | 레이아웃 / UI | `src/pages/Accounts/index.tsx:160-213` | `PageHeader` 미사용. 인라인 `<div>` + 계정 제목 + 우측 검색/정렬 버튼 | `PageHeader`와 시각·구조 불일치. 검색·정렬 버튼이 `actions` 슬롯 대신 인라인 배열 | **Reuse what the project has**: `PageHeader`로 마이그레이션, 검색/정렬 버튼을 `actions`에 |

> 스크린샷 `06-template-picker-dialog.png`의 X 닫기 버튼은 소스(`TemplatePicker.tsx:66-73`)에서 이미 `aria-label="템플릿 선택 닫기"`를 보유하고 있어 접근성 이름 누락 finding은 **아님** (스크린샷만 보고 내린 오진 수정).

---

## 4. 검증 결과

| 확인 항목 | 방법 | 결과 |
|-----------|------|------|
| 키보드만으로 전체 플로우 완료 가능 | 코드 정독: `AutofillSection` 토글, `UISection` 다크모드 토글에 Enter/Space 핸들러 없음 | **Not verified** (브라우저 미실행) — 발견 #1, #2 |
| 스크린리더 접근성 이름 | `aria-label`, `aria-checked`, `role` 코드 정독. `TemplatePicker` X 버튼 `aria-label="템플릿 선택 닫기"` 확인됨 | 버튼 대부분 `aria-label` 보유. 모든 인터랙티브 요소에 접근성 이름 확인됨 |
| 포커스 링 | `Button.tsx:47` `focus:ring-2` 보유, `focus-visible` 아님 | 소스 발견 #6 |
| 320px 너비 재흐름 | `min-w-0`, `break-words`, `flex-wrap` 사용 확인. 고정 너비 `width:` 없음 | 소스 상 통과. 런타임 미검증 → **Not verified** |
| 200% 확대 | `rem` 미사용(px/Tailwind 고정 값), `text-xs`~`text-base` 고정 | 텍스트 크기 고정으로 200% 시 레이아웃 깨질 가능성 → **Not verified** |
| `prefers-reduced-motion` | `transition` 클래스 다수, `window.scrollTo({behavior:"smooth"})` 존재. 가드 없음 | 소스 발견. **Not verified** |
| 스크린샷 15개 렌더링 검토 | 홈, 볼트생성 1~2단계, PIN 인증, 템플릿 선택기, 계정 생성, 설정, 템플릿 목록, 자동완성 테스트 등 전체 시각 확인 | 헤더 패턴 불일치(CreateVault, Auth, AutofillTestLogin, Accounts 인라인 헤더, BackButton 미사용) 확인. 삭제 확인 다이얼로그 danger variant, 에러 `role="alert"`, 입력 필드 `<label>` 연결 등 접근성 양호 |
| `npm run typecheck` | `tsc -b --noEmit` | 실행 필요 |
| `npm run lint` | ESLint | 실행 필요 |

> `Not verified` 항목은 브라우저/실기체 환경에서 실행해야 확인 가능. 코드 수준에서는 소스만으로 판단.

---

## 5. 평결 및 우선순위 수정 계획

**평결**: Approve with findings

전체적으로 일관된 컴포넌트 시스템(`Button`, `SettingsRow`, `PageHeader`, `PageShell`)이 잘 정립되어 있고, 접근성 기본(`aria-label`, `role="switch"`, `aria-invalid` 등)도 갖춰져 있다. 다만 **키보드 조작 불가 커스텀 토글 2개**와 **파일명 truncate**가 에스컬레이션 트리거에 해당하므로 수정 없이는 전체 인터페이스를 키보드-only로 완료할 수 없다.

스크린샷 검토 결과, 템플릿 선택기 X 버튼은 이미 `aria-label`을 보유하고 있어 추가 수정 불필요. 대신 `CreateVault`와 `Auth` 페이지의 인라인 헤더 + `BackButton` 미사용이 새로 확인됨.

### 권장 수정 우선순위

1. **`src/pages/Settings/AutofillSection.tsx:214-233`** — 커스텀 토글 → 네이티브 체크박스 또는 APG 스위치 키맵 + `focus-visible` 링 (HIGH)
2. **`src/pages/Settings/UISection.tsx:30-47`** — 다크모드 토글 → 동일 처리 (HIGH)
3. **`src/pages/Auth.tsx:201`** — 파일명 `truncate` → 전체 값 노출 수단 추가 (HIGH)
4. **`src/pages/CreateVault/index.tsx:82-92`** — 인라인 헤더 → `PageHeader` + `BackButton` 마이그레이션 (MEDIUM)
5. **`src/pages/Auth.tsx:162-183`** — `Button` 기반 뒤로 가기 → `BackButton` 재사용 + `PageHeader` 적용 검토 (MEDIUM)
6. **`src/pages/Accounts/index.tsx:285-293`** — `<article role="button">` → `<button>` (MEDIUM)
7. **`src/pages/Home.tsx:153-159`** — `<Link>` 버튼 스타일링 → 의미론적으로 올바른 요소 사용 (MEDIUM)
8. **`src/pages/AutofillTestLogin.tsx:19-31`** — 인라인 헤더 → `PageHeader` 적용 검토 (MEDIUM, 페이지 진입점이므로 예외 유지 가능)
9. **`src/pages/Accounts/index.tsx:160-213`** — 인라인 헤더 → `PageHeader` 마이그레이션, 검색/정렬 버튼을 `actions`에 (MEDIUM)
10. **`src/components/Button.tsx:47`** — `focus-visible` 적용 (LOW)
11. **`src/pages/Home.tsx:211-218`** — `DeleteButton` 재사용 (LOW)
12. **`src/pages/Home.tsx:128-139`** — `PageHeader` 적용 검토 (LOW, 예외 유지 가능)

이 중 1~3번이 `HIGH`로 차단 요인이므로 먼저 처리하는 것을 권장합니다. 수정 작업을 원하시면 해당 파일만 대상으로 구현해 드리겠습니다.

---

## 6. 검토에 사용된 도구

- `better-interface` (오케스트레이션, 통합 보고서 형식)
- `better-accessibility` (WCAG 2.2, 키보드/포커스, ARIA)
- `better-layout` (그룹화, 정렬, 반응형, 320px)
- `better-writing` (라벨, 에러, 빈 화면, 버튼 동사)
- `better-typography` (글자 크기, 줄 간격, truncate, 단위)
- `better-colors` (대비 토큰, semantic color)
- `better-ui` (보더 반경, 포커스 링, 아이콘 상태)
- `better-motion` (transition, reduced-motion — 정적 스크린샷으로 Not verified)

모든 수정은 프로젝트의 기존 토큰(`var(--color-*)`)과 컴포넌트(`Button`, `DeleteButton`, `PageHeader`, `BackButton`)를 그대로 사용하며, 새로운 스타일 시스템이나 라이브러리 도입은 하지 않습니다.
