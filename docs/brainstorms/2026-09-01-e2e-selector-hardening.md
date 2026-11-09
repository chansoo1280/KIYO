# 2026-09-01 — E2E Selector Hardening

> PR #58 (Plan-G1~G5 컴포넌트 통합) 머지 직후 e2e에서 발견한 회귀와 그 결과를 정리한 brainstorm.
> 후속 작업 트리거를 식별하고, selector 전략을 다시 잡는다.

---

## 1. 배경

PR #58 (`c010318f`)은 13개 페이지 wrapper를 단일 `PageShell` 컴포넌트로 통합하면서
`<main|section> min-h-svh ...` 패턴을 `<main>` 태그로 통일했다 (Plan-G2 Q5 결정).

이후 React E2E 실행 결과 **5개 테스트 실패** — 모두 selector `section.min-h-svh` 매치 실패:

| 파일:라인 | 시나리오 |
|---|---|
| `e2e/02-unlock.spec.ts:14` | 올바른 PIN으로 기존 볼트 잠금 해제 → `/accounts` 진입 |
| `e2e/02-unlock.spec.ts:82` | 비암호화 볼트 새로고침 후 바로 `/accounts` 진입 |
| `e2e/06-lock.spec.ts:21` | 새로고침 잠금 → `/auth` → PIN 입력 후 재진입 |
| `e2e/11-close-datafile.spec.ts:120` | Auth "첫 화면으로 돌아가기" → 다시 볼트 생성 |
| `e2e/11-close-datafile.spec.ts:150` | Settings "파일변경" → 다시 볼트 생성 |

수정: selector 5건 `section.min-h-svh` → `main.min-h-svh`로 교체. 회귀 0/44.

---

## 2. 회귀 분석 — 무엇이 깨졌나

### 2.1 직접 원인
- `PageShell`이 wrapper를 `<main className="min-h-svh">`로 렌더 (PageShell.tsx:45)
- 기존 페이지(Accounts/Detail/Edit/Home/Auth)는 `<section>` 또는 `<main>`을 자체 정의
  - Home/Auth/AccountDetail은 이미 `<main>`이었으므로 영향 없음
  - **AccountList(Accounts/index.tsx)** 두 분기(loading/loaded) 모두 `<section>` → `<PageShell>`로 교체

### 2.2 구조 의존 selector의 회귀 위험
PR #58은 디자인 의도가 분명했고 (`<main>` 통일) selector만 따라잡으면 끝이지만,
이번 건은 **wrapper 클래스/태그에 의존하는 selector가 컴포넌트 리팩터링 회귀의 1차 표면**임을 확인.

### 2.3 PR 머지 후 발견된 부수 콘솔 경고
```
Encountered two children with the same key, `0`.
```
같은 빌드에서 발생 — Plan-G5 FieldCard 통합 또는 PageShell 구조 변화 영향 가능성.
실패로 이어지지 않지만 별도 추적 필요.

---

## 3. selector 감사 (2026-09-01)

`e2e/` 전체 115개 `page.locator(...)` 호출 분류:

| 카테고리 | 셀렉터 예 | 사용처 | 평가 |
|---|---|---|---|
| **의미 명확 (OK)** | `input[type="password"]` (15), `article[role="button"]` (14), `input[placeholder="..."]` (7), `button[aria-label*]` 다수, `text=...` 다수, `[role="alert"]` (2), `select[aria-label]` (2), `data-testid` | 광범위 | 사용자 인지 가능 |
| **wrapper 의존 (이번 수정)** | `main.min-h-svh` (5) | 02/06/11 spec | OK |
| **클래스명 의존 (위험)** | `button.rounded-full.px-3.py-1.5` (1) | `pages/HomePage.ts:55` (tagButtons) | **위험** |
| **wrapper 구조 의존 (위험)** | `div.group h3.font-semibold` (1), `div.group.rounded-2xl.border` (4), `div.mt-3.space-y-3 > div.rounded-2xl.border` (1), `div.space-y-3 > div` (1) | TemplatePages, 05 spec | **위험** |

### 3.1 위험 셀렉터 6건 (전수)

| # | 셀렉터 | 사용처 | 의존 컴포넌트 |
|---|---|---|---|
| 1 | `button.rounded-full.px-3.py-1.5` | `e2e/pages/HomePage.ts:55` | `Accounts/index.tsx:241` (tag 버튼) — false match 위험, **Accounts의 버튼은 `rounded-full px-3 py-1.5` 다른 variant** → 사실 안전 |
| 2 | `div.group h3.font-semibold` | `e2e/pages/TemplatePages.ts:58` | `Templates/index.tsx:62` 카드 |
| 3 | `div.group.rounded-2xl.border` | `e2e/pages/TemplatePages.ts:12/28/41/223` | 동일 카드 |
| 4 | `div.mt-3.space-y-3 > div.rounded-2xl.border` | `e2e/05-template-account.spec.ts:53` | `AccountFieldsSection.tsx:32` 래퍼 |
| 5 | `div.space-y-3 > div` | `e2e/pages/TemplatePages.ts:101` | `TemplateEdit/index.tsx:260` 래퍼 |

---

## 4. Q1. 즉시 수정 vs 다음 리팩터링 때 같이?

**Option A — 지금 즉시 잡기**
- 위험 6건을 `getByRole('button', { name: '...' })`, 의미적 라벨 추가 후 `getByLabel`/`getByRole`로 변환
- **`data-testid` 도입은 회피** — STRATEGY §5 "User-Centric Selectors" 원칙: aria/role이 본질적으로 부여 가능하면 testid 도입 안 함. 컴포넌트에 의미적 라벨이 부족하면 라벨 부여 우선, testid는 최후 수단 (복수 호출처 · aria 부재 시 한정)
- 회귀 차단 효과 즉시
- 비용: ~2시간 + 컴포넌트에 aria-label/role 보강 (Template 카드, TemplateEdit 필드 row, AccountList tag 버튼, AccountFieldsSection 래퍼)

**Option B — 다음 리팩터링 때 같이**
- PR #58 류의 통합 PR에서 같이 selector 정리
- 식별만 메모하고 보류
- 비용: 0, 회귀 차단 효과 지연

**Option C — lint 규칙 추가 (구조 의존 차단)**
- ESLint rule로 `e2e/`에서 `tag.class` 패턴 경고
- 새 selector 추가 자체를 막음
- 비용: ESLint rule 구현 + 기존 6건은 통과시키기 위해 suppress
- 효과: 회귀 차단 자동화

**Q2. cell #1 (HomePage tag 버튼)은 진짜 위험인가?**
- `Accounts/index.tsx:241`은 `rounded-full px-3 py-1.5` (특정 class) — variant가 같은 클래스 조합 → **false match 가능**
- 다만 HomePage.ts:55는 tag filter 버튼만 노리고, Accounts에 tag가 있으면 매치될 수 있음 — 진짜 위험
- **결론: 진짜 위험, A 또는 B 필요**

---

## 5. 결정 (사용자 대기)

| # | 결정 | 옵션 |
|---|---|---|
| Q1 | 위험 selector 6건 처리 시점 | A (즉시) / B (다음 리팩터링) / C (lint 규칙 추가) |
| Q2 | `button.rounded-full.px-3.py-1.5` 단독 처리 | A-1 (aria-label 부여 → `getByRole`) / A-2 (HomePage.ts만 수정) / 보류 |
| Q3 | 부수 콘솔 경고 (중복 key) 추적 | 단독 task / 다음 PR에서 / 무시 |
| Q4 | STRATEGY.md Track 5 갱신 범위 | 이 brainstorm 결과만 / 향후 plan까지 함께 |
| Q5 | `data-testid` 정책 | 이미 STRATEGY §5 반영 — "비선호, aria/role 우선, 최후 수단만" |

---

## 6. 다음 단계 (decision-free)

1. **즉시 진행 가능**: STRATEGY.md Track 5 갱신 (사용자 지시 완료 시)
2. **Q1 결정 후 진행 가능**: 위험 6건 selector migration plan (aria/role 기반)
3. **별개 추적**: 중복 key 경고 (Q3 결정 시)