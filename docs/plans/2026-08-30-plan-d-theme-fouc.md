# Plan-D — 초기 라우팅 구조 + 테마 FOUC 가드 + 시스템 설정 연동

- Date: 2026-08-30
- Source: [`docs/brainstorms/2026-08-30-track3-ux-accessibility.md`](../brainstorms/2026-08-30-track3-ux-accessibility.md) §7 D, §8.1, §10 Q6, §11
- 선행: [Multi-Vault Support](./2026-08-30-multi-vault-support.md) ✅, [Plan-7a](./2026-08-30-plan-7a-create-vault-multistep.md) ✅, [Plan-A1](./2026-08-30-plan-a1-error-visibility.md) ✅, [Plan-A2](./2026-08-30-plan-a2-spinner-loading.md) ✅, [Plan-B-1](./2026-08-30-plan-b-button-loading-consistency.md) ✅, [Plan-B-2](./2026-08-30-plan-b-button-loading-consistency.md) ✅
- 의존: 없음 (theme + 초기 라우팅 인프라 독립)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: §결정 (사용자 결정 대기 항목 포함) 참고
- **신규 plan** — Track 3 brainstorm §7 D를 별도 plan으로 분리 작성. **2026-08-30 사용자 결정: SplashScreen + `/` 라우트 리팩토링 + 테마 FOUC 가드 흡수**

---

# Goal

**앱 진입 시 첫 paint의 테마 깜빡임(FOUC)을 제거**하고, **`/` 라우트를 redirect 전용 entry로 분리**하며, **시스템 설정 연동**(시스템 다크/라이트 따라가기 + live 갱신)을 추가한다.

완료 시 다음이 참:
- `index.html` inline `<style>` + `<script>` — React mount 전 light/dark 토큰 결정 (FOUC 가드)
- `SplashScreen` 컴포넌트 신규 — unlock 직후 accounts/templates preload 중 표시
- `RootRedirect` 컴포넌트 신규 — `cryptoKey` 분기 (`null` → `/auth`, `set` → preload → `/accounts` 또는 실패 시 `ErrorScreen`)
- `ErrorScreen` 컴포넌트 신규 — preload 실패 시 표시 (`홈으로` 버튼 → `/home`)
- `/` 라우트가 `RootRedirect`로 변경, 기존 `Home`은 `/home`으로 이동
- `Home` 내부의 "redirect 로직" (line 34-53 useEffect) 제거 — RootRedirect가 담당
- `App.tsx`의 useEffect 5개 (`loadAccounts`/`loadTemplates`/`initializeTheme`/`initializeFontSize`/`initializeAutoLockTimeout`) 제거 — RootRedirect가 unlock 직후 책임
- `settingsStore`의 `initialized` 게이트 제거 — Bootstrap 불필요 (App.tsx에서 useEffect로 강제 hydrate race 해결하던 장치 폐기)
- 시스템 설정(prefers-color-scheme) 자동 감지 — `themeMode: "light" | "dark" | "system"` 추가
- 시스템 설정 변경 시 live 갱신 (`matchMedia` 리스너)
- UISection UI: 3-way 토글(라이트/다크/시스템)

**Bootstrap 폐기 결정 (2026-08-30):**
- main.tsx에서 await하는 전역 Bootstrap 계층은 도입하지 않음
- 데이터 preload는 RootRedirect가 unlock 감지 시점에만 책임짐 (lock 상태에선 preload 안 함)
- `App.tsx`의 `initialized` 게이트는 더 이상 필요 없음 — RootRedirect가 SplashScreen/ErrorScreen/Navigate를 직접 제어

**PR 분할 (2026-08-30 사용자 결정):**
- **PR 1 — 라우트 + FOUC 가드 + RootRedirect** (inline script + SplashScreen + RootRedirect + ErrorScreen + App.tsx 단순화 + Home.tsx redirect 제거)
- **PR 2 — themeMode + UI** (`themeMode` 추가 + `setThemeMode` + `initializeTheme` 확장 + UISection 3-way) — PR 1 머지 후 진행

**범위 밖 (Plan-D):**
- 컬러 팔레트 자체 변경 (색상 토큰 재설계) — 별도 plan
- 폰트 패밀리 추가 — 별도 plan
- a11y contrast ratio 자동 측정 — 별도 plan
- i18n 정식 도입 — 별도 plan
- Home 내부 기능 자체 리팩토링 (파일 리스트 UI, 삭제 다이얼로그 등) — 본 plan은 라우팅 이동만

---

# Current State (2026-08-30 인스펙션)

## 라우팅/초기화 관련 코드

| 파일 | 내용 | 상태 |
|---|---|---|
| `src/main.tsx` | `createRoot(...).render(<StrictMode><App /></StrictMode>)` | 동기 React mount (Bootstrap 없음) |
| `index.html` | inline script **없음** | 첫 paint 시 FOUC 가드 부재 — light 토큰으로 시작, React mount 후 dark 토큰 적용 시 깜빡임 |
| `src/App.tsx` line 33-51 | 5개 useEffect (`loadAccounts`/`loadTemplates`/`initializeTheme`/`initializeFontSize`/`initializeAutoLockTimeout`) | React mount 후 fire-and-forget 실행. lock 상태에서도 accounts/templates를 무조건 로드하는 비효율 |
| `src/App.tsx` line 57 | `<Route path="/" element={<Home />} />` | `/`이 실제 Home 페이지 + redirect 둘 다 |
| `src/pages/Home.tsx` line 34-53 | `useEffect`에서 session 확인 → `/auth` 또는 `/accounts`로 `navigate({ replace: true })` | **Home이 실제 UI + redirect 중간 페이지** — 사용자 인지 flash 가능 |
| `src/store/settingsStore.ts` | `theme: "light" \| "dark"`, `setTheme`, `toggleTheme`, `initializeTheme` | 시스템 감지/매치/matchMedia **모두 없음** |
| `src/index.css` line 80-98 | `@media (prefers-color-scheme: dark) { :root:not(.light) { ... } }` | 시스템 매치 존재, `.light` class 적용 시 무력화 |
| `src/pages/Settings/components/UISection.tsx` | 토글 스위치 (`role="switch"`) | 2-way (light/dark), system 옵션 없음 |

## FOUC 발생 시나리오 (현재)

1. 사용자: dark 모드로 설정, 앱 재시작
2. HTML 파싱 → CSS 로드 → 첫 paint: `:root` = light 토큰 (CSS 기본값)
3. React mount → `useEffect` → `initializeTheme()` 호출
4. `document.documentElement.classList.add("dark")` → CSS 재계산 → dark 토큰
5. **사용자 관찰: light → dark 깜빡임** (수십~수백 ms)

저장된 `theme`이 light일 때는 깜빡임 없음. dark일 때만 발생.

**Plan-D의 처리 방식 (inline script)**: `index.html`의 inline `<script>`가 React mount 전에 `localStorage.kiyo-settings`에서 `theme`을 읽어 `<html>`에 `class="dark"`(또는 `class="light"`)를 동기 적용 → 첫 paint부터 정확한 테마. inline `<style>`도 동일 시점에 적용하여 splash 시각적 일관성 확보.

## Home의 이중 역할 문제

- `/` 진입 → Home 렌더링 → Home이 session 확인 후 redirect → `/auth` 또는 `/accounts`
- 짧더라도 Home 화면(파일 리스트)이 잠깐 보였다가 사라지는 flash 가능
- multi-vault로 Home이 실제 페이지 역할을 가지게 되면서 충돌
- **해결**: `/`은 RootRedirect 전용, Home은 `/home`으로 이동

---

# Proposed Changes

## Plan-D-1 PR (라우트 + FOUC 가드 + RootRedirect) — 첫 번째 PR

### 1-A. `index.html` — inline splash HTML + script (FOUC 가드)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#aa3bff" />
    <title>kiyo</title>
    <style>
      /* FOUC 가드 inline CSS — React mount 전 light/dark 토큰 결정 */
      html { color-scheme: light dark; }
      html.light { color-scheme: light; }
      html.dark { color-scheme: dark; }
      /* Splash 표시 — React mount 후 SplashScreen이 덮어씀 */
      #splash {
        position: fixed; inset: 0; display: flex;
        align-items: center; justify-content: center;
        background: #fff; color: #6b6375;
        font: 18px/145% system-ui, sans-serif;
      }
      html.dark #splash { background: #16171d; color: #9ca3af; }
    </style>
    <script>
      // FOUC 가드 — React mount 전에 theme 결정
      (function () {
        try {
          var stored = null;
          try { stored = localStorage.getItem("kiyo-settings"); } catch (e) {}
          // theme 필드 fallback 사용 (Q-Inline-Script-Default-b 결정)
          // PR 1: themeMode는 partialize에 없으므로 theme 필드만 검사
          // PR 2: themeMode 도입 후 본 스크립트의 검출 로직도 동시 갱신 필요
          if (stored) {
            try {
              var parsed = JSON.parse(stored);
              var s = parsed && parsed.state ? parsed.state : parsed;
              if (s) {
                // stored에 명시적 theme이 있을 때만 클래스 적용
                // stored가 없거나 theme 필드가 없으면 <html>에 클래스 두지 않음 →
                // index.css의 `@media (prefers-color-scheme: dark) :root:not(.light)` 매치미디어가
                // OS 설정을 따라 첫 paint 결정 → store 기본값 light와도 충돌 없음
                var html = document.documentElement;
                html.classList.remove("light", "dark");
                if (s.theme === "dark") html.classList.add("dark");
                else if (s.theme === "light") html.classList.add("light");
              }
            } catch (e) {}
          }
        } catch (e) {
          // localStorage 접근 실패 시 매치미디어에 위임 (클래스 미적용)
        }
      })();
    </script>
  </head>
  <body>
    <div id="splash" aria-hidden="true">kiyo</div>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**핵심 결정:**
- inline `<style>` + `<script>` — React mount 전 동기 적용 보장 (FOUC 0)
- **stored에 명시적 theme이 있을 때만 `<html class="dark|light">` 적용** (Q-Inline-Script-Default-b). stored가 없거나 theme 필드가 없으면 클래스 미적용 → `index.css:80`의 `@media (prefers-color-scheme: dark) :root:not(.light)` 매치미디어가 OS 설정을 따라 첫 paint 결정. **store 기본값 `theme: "light"`와의 어긋남 없음** (Q-FOUC-Default-b 결정)
- PR 2에서 `themeMode` 추가 시 inline script의 검출 로직도 동시 갱신 필요 (Cross-Plan Integration § 참조)
- `try/catch`로 localStorage 접근 실패(SSR/disabled) 대비 — 실패 시 매치미디어에 위임
- `<div id="splash">` — React mount 후 SplashScreen이 root를 덮으면 splash DOM은 SplashScreen이 정리

### 1-B. `src/components/SplashScreen.tsx` (신규)

```tsx
import { useEffect } from "react";
import { Spinner } from "@/components/feedback/Spinner";

/**
 * RootRedirect의 unlock-preload 진행 중 표시되는 splash.
 * index.html의 inline splash DOM (`#splash`)을 mount 시 정리.
 */
export function SplashScreen() {
  useEffect(() => {
    // index.html의 inline splash DOM 제거
    const el = document.getElementById("splash");
    if (el) el.remove();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="앱 초기화 중"
      className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)]"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" aria-hidden />
        <span className="text-sm">kiyo</span>
      </div>
    </div>
  );
}
```

### 1-C. `src/pages/RootRedirect.tsx` (신규)

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SplashScreen } from "@/components/SplashScreen";
import { ErrorScreen } from "@/components/ErrorScreen";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { fileTable } from "@/database/fileTable";
import type { ActiveFileInfo } from "@/database/fileTable";

/**
 * `/` 진입점 — 세션 + 파일 상태에 따라 분기:
 *
 *   - activeFileName === null       → /home navigate (파일 선택 UI)
 *   - activeFileName !== null, encrypted === true, cryptoKey === null
 *                                   → /auth navigate (PIN 입력)
 *   - activeFileName !== null, encrypted === true, cryptoKey !== null
 *                                   → Splash 표시하며 loadAccounts + loadTemplates 병렬 await
 *                                       ├─ 성공 → /accounts navigate (replace)
 *                                       └─ 실패 → ErrorScreen 표시
 *   - activeFileName !== null, encrypted === false
 *                                   → Splash 표시하며 loadAccounts + loadTemplates 병렬 await
 *                                       ├─ 성공 → /accounts navigate (replace)
 *                                       └─ 실패 → ErrorScreen 표시
 */

type Status =
  | { kind: "redirecting"; target: "/home" | "/auth" | "/accounts" }
  | { kind: "preloading" }
  | { kind: "error"; error: unknown };

export function RootRedirect() {
  const navigate = useNavigate();
  // Zustand selector — 컴포넌트가 activeFileName/cryptoKey에 의존함을 React에 선언
  const activeFileName = useSessionStore((s) => s.activeFileName);
  const cryptoKey = useSessionStore((s) => s.cryptoKey);
  const loadAccounts = useAccountStore((s) => s.loadAccounts);
  const loadTemplates = useTemplateStore((s) => s.loadTemplates);

  const [status, setStatus] = useState<Status>({ kind: "preloading" });
  // null = 미조회 또는 activeFileName 없음. ActiveFileInfo = 조회됨 (activeFileName으로 stale 분기).
  const [info, setInfo] = useState<ActiveFileInfo | null>(null);

  // 1. activeFileName 변경 시 fileInfo 재조회 (Zustand selector가 re-render 트리거)
  useEffect(() => {
    let cancelled = false;
    if (!activeFileName) {
      setInfo(null);
      return;
    }
    (async () => {
      try {
        const result = await fileTable.getFileInfo(activeFileName);
        if (cancelled) return;
        setInfo(result);
      } catch (err) {
        if (cancelled) return;
        setStatus({ kind: "error", error: err });
      }
    })();
    return () => { cancelled = true; };
  }, [activeFileName]);

  // 2. info + cryptoKey + activeFileName 변경 시 분기 결정 (redirecting vs preloading)
  useEffect(() => {
    if (status.kind === "error") return;
    if (!activeFileName) {
      // 활성 파일 없음 → /home (파일 선택 UI)
      setStatus({ kind: "redirecting", target: "/home" });
      return;
    }
    if (!info) {
      // activeFileName 있는데 info 조회 중 (effect 1 진행) 또는 실패 — 분기 보류
      return;
    }
    if (!info.activeFileName) {
      // store activeFileName이 DB에 없음 → stale (effect 5에서 ErrorScreen 렌더)
      return;
    }
    if (info.encrypted && cryptoKey === null) {
      // 잠긴 상태 → /auth (PIN 입력)
      setStatus({ kind: "redirecting", target: "/auth" });
      return;
    }
    // unlocked (cryptoKey set) 또는 plaintext → preload
    setStatus({ kind: "preloading" });
  }, [activeFileName, info, cryptoKey, status.kind]);

  // 3. preload 시작 (unlocked 또는 plaintext)
  useEffect(() => {
    if (status.kind !== "preloading") return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadAccounts(), loadTemplates()]);
        if (cancelled) return;
        setStatus({ kind: "redirecting", target: "/accounts" });
      } catch (err) {
        if (cancelled) return;
        setStatus({ kind: "error", error: err });
      }
    })();
    return () => { cancelled = true; };
  }, [status.kind, loadAccounts, loadTemplates]);

  // 4. redirecting 상태일 때 navigate 실행
  useEffect(() => {
    if (status.kind !== "redirecting") return;
    navigate(status.target, { replace: true });
  }, [status, navigate]);

  // 5. stale info 시 ErrorScreen 표시 (clearSession은 호출 안 함 — 사용자가 명시적 복구)
  if (info && !info.activeFileName && activeFileName) {
    return <ErrorScreen variant="stale" missingFileName={activeFileName} />;
  }

  if (status.kind === "error") {
    return <ErrorScreen variant="generic" error={status.error} />;
  }

  return <SplashScreen />;
}
```

**핵심 결정:**
- **3-state 명시적 분기** (`redirecting` | `preloading` | `error`) + raw `info: ActiveFileInfo` 보관 — Discriminated union으로 `target` 필드 안전성 보장. stale 감지는 wrapper state 대신 `info.activeFileName === null`로 단일 검사.
- **`activeFileName === null`** → `/home` (Q-ActiveFile-Default-a) — 파일 선택 UI
- **`activeFileName` set + `getFileInfo` null 반환 (DB에 없음)** → `ErrorScreen variant="stale"` 표시 (Q-FileInfo-Stale-a) — 데이터 정합성 보장, 자동 복구 안 함, 사용자가 명시적으로 다른 vault 선택
- **`activeFileName` set + `encrypted` true + `cryptoKey` null** → `/auth` (PIN 입력 필요)
- **`activeFileName` set + `encrypted` true + `cryptoKey` set** → preload → `/accounts` (unlock 직후 accounts/templates 로드) — **단, `cryptoKey`는 partial 대상 아님 → `/` 직접 진입 시 항상 null → 분기는 사실상 plaintext active 직접 진입에서만 발화** (plan-review 검증)
- **`activeFileName` set + `encrypted` false (plaintext)** → preload → `/accounts` (cryptoKey 없이 바로 accounts/templates 로드)
- `cancelled` 플래그로 모든 async effect unmount 시 setState 회피
- 4단계 effect 분리 — `info 조회` / `분기 결정` / `preload` / `navigate` + stale/error 렌더 게이트 — 각자 단일 책임

**`fileTable.getFileInfo` 사용 이유 (Home.tsx:38 참조):**
- 기존 Home의 redirect 로직이 `fileTable.getFileInfo(activeFileName)`으로 `{ activeFileName, encrypted }` 조회
- RootRedirect가 같은 패턴을 재사용 — Home의 redirect 로직을 완전히 이관하는 셈
- `getFileInfo`는 Dexie 단일 read로 가벼움 (수 KB) — preload 전에 분기 결정용으로 적합
- **`activeFileName` 검증 목적**: store activeFileName이 DB에 존재하지 않는 경우 감지 (사용자가 다른 기기/탭에서 vault 삭제, Dexie corruption 등) → ErrorScreen variant="stale"

### 1-D. `src/components/ErrorScreen.tsx` (신규)

```tsx
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { useSessionStore } from "@/store/sessionStore";

type ErrorScreenProps =
  | { variant: "generic"; error?: unknown }
  | { variant: "stale"; missingFileName: string };

/**
 * RootRedirect의 에러/데이터 정합성 화면.
 * - variant="generic": preload 실패 시 표시 (사용자 안내 + "홈으로" 버튼 → /home)
 * - variant="stale": store activeFileName이 DB에 존재하지 않을 때 표시
 *   (사용자가 명시적으로 다른 vault를 선택하도록 안내. clearSession은 호출 안 함 — 사용자 주도 복구)
 */
export function ErrorScreen(props: ErrorScreenProps) {
  const navigate = useNavigate();

  if (props.variant === "stale") {
    return (
      <main
        role="alert"
        aria-live="assertive"
        className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 py-8 text-[var(--color-text)]"
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-error-bg)] text-[var(--color-error)]">
            !
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-text-h)]">
            활성 파일을 찾을 수 없습니다
          </h1>
          <p className="text-center text-sm leading-6 text-[var(--color-text)]">
            마지막으로 열었던 파일이 저장소에서 사라졌습니다.
            <br />
            다른 파일을 선택하거나 새로 만들 수 있습니다.
          </p>
          <p className="text-xs text-[var(--color-text-muted)]" aria-label="누락된 파일명">
            {props.missingFileName}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button
              label="홈으로"
              variant="primary"
              onClick={() => navigate("/home", { replace: true })}
            />
          </div>
        </div>
      </main>
    );
  }

  // variant === "generic"
  const message = props.error instanceof Error ? props.error.message : "알 수 없는 오류";
  return (
    <main
      role="alert"
      aria-live="assertive"
      className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 py-8 text-[var(--color-text)]"
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-error-bg)] text-[var(--color-error)]">
          !
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-text-h)]">
          데이터를 불러올 수 없습니다
        </h1>
        <p className="text-center text-sm leading-6 text-[var(--color-text)]">
          잠금 해제는 되었지만 파일 데이터를 읽는 중 오류가 발생했습니다.
          <br />
          다른 파일을 선택하거나 새로 만들 수 있습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)]" aria-label="에러 상세">
          {message}
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button
            label="홈으로"
            variant="primary"
            onClick={() => navigate("/home", { replace: true })}
          />
        </div>
      </div>
    </main>
  );
}
```

**핵심 결정:**
- `variant: "generic" | "stale"` Discriminated union — TypeScript가 사용처에서 variant별 prop 강제
- `variant="generic"`: preload 실패 (Q-Error-Home-Target-a) — "데이터를 불러올 수 없습니다" 안내
- `variant="stale"`: store activeFileName이 DB에 없음 (Q-FileInfo-Stale-a) — "활성 파일을 찾을 수 없습니다" 안내 + 누락된 파일명 표시
- 두 variant 모두 `role="alert"` + `aria-live="assertive"` — 스크린리더가 즉시 안내 읽도록
- `Button` 사용 — Plan-B-3 표준 (label prop 필수, F-1 Note 참조)
- **`useSessionStore` import**: `variant="stale"`에서 `clearSession()` 호출 여부를 결정하기 위해 import. **현재 plan에서는 호출 안 함** — 사용자가 명시적으로 다른 파일 선택 시 Home.tsx:55-69 handleSelectFile이 clearSession 호출. stale 상태에서 자동 clearSession은 보수적 회피 (사용자 인지 없이 store 변경 위험)
- 홈으로 버튼은 동일 — `/home`으로 navigate (replace)

**`useSessionStore.clearSession()` 호출하지 않는 결정의 근거 (Q-FileInfo-Stale-a):**
- 자동 복구(`clearSession` → `/home`)는 사용자가 stale state를 인지 못 한 채 진행 → 디버깅 어려움
- 명시적 안내(ErrorScreen)는 사용자가 "이 파일이 사라졌다"는 사실을 인지 → 데이터 손실 디버깅/복구 단서 제공
- 사용자가 "홈으로" → `/home` 진입 → Home.tsx:55-69 handleSelectFile이 새 파일 선택 시 `clearSession` 호출 → stale state 자연 정리

### 1-E. `src/store/settingsStore.ts` — `initializeFontSize` `onRehydrateStorage` 이관 (PR 1 변경)

```ts
// 변경 — settingsStore.ts의 persist 옵션에 onRehydrateStorage 콜백 추가
// initializeFontSize()는 side effect(<html>에 text-size 클래스 적용)만 하므로
// persist hydrate 직후 자동 호출되도록 콜백으로 이동.
// initializeAutoLockTimeout은 no-op mark 호출뿐이라 이관 불필요 (PR 2/별도 plan 보류).
// initializeTheme은 PR 2에서 matchMedia 시스템 모드와 함께 재설계 (별도 검토).
export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // ... 기존 초기값/메서드 그대로
      }),
      {
        name: "kiyo-settings",
        storage: createJSONStorage(() => localStorage),
        onRehydrateStorage: () => (state) => {
          // persist hydrate 직후 1회 호출 — <html>에 font-size 클래스 적용
          if (state) {
            const fontSize = state.fontSize;
            const fontSizeClass =
              fontSize === "small" ? "sm" : fontSize === "medium" ? "base" : "lg";
            document.documentElement.classList.remove(
              "text-size-sm",
              "text-size-base",
              "text-size-lg",
            );
            document.documentElement.classList.add(`text-size-${fontSizeClass}`);
          }
        },
      },
    ),
    { name: "settings-store" },
  ),
);
```

**핵심 결정:**
- **`initializeFontSize` → `onRehydrateStorage` 콜백으로 이관** — App.tsx useEffect 제거 후에도 reload 시 font-size 클래스가 `<html>`에 즉시 적용됨 (회귀 0)
- **`initializeAutoLockTimeout`은 no-op mark 호출뿐** — 이관 불필요. PR 2 또는 별도 plan에서 처리
- **`initializeTheme`은 PR 2에서 재설계** — matchMedia 시스템 모드 + live 갱신. inline script가 첫 paint theme을 결정하므로 PR 1 시점에 React side effect 불필요 (plan §1-A inline script + §1-A 다음 section 참조)
- 기존 `initialize*` 메서드는 그대로 유지 — 다른 호출처가 있을 경우 보존. PR 2에서 통합 정리
- `initialized` 게이트 폐기 — RootRedirect의 cryptoKey 분기 + status state로 대체 (변경 없음)

### 1-F. `src/App.tsx` — useEffect 5개 제거 + 단순화

```tsx
function App() {
  const { remainingSeconds } = useAutoLock();

  return (
    <BrowserRouter>
      <AndroidBackButtonHandler />
      <Routes>
        {/* `/` → RootRedirect (cryptoKey 분기 + preload + /accounts 또는 /auth) */}
        <Route path="/" element={<RootRedirect />} />

        {/* 실제 Home은 /home으로 이동 */}
        <Route path="/home" element={<Home />} />

        {/* 기존 라우트 그대로 */}
        <Route path="/create-vault" element={<CreateVaultPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/accounts" element={<AccountList />} />
        {/* ... */}
      </Routes>
      <AutoLockIndicator remainingSeconds={remainingSeconds} />
      <SyncErrorBanner />
    </BrowserRouter>
  );
}
```

**핵심 결정:**
- 5개 useEffect (`loadAccounts`/`loadTemplates`/`initializeTheme`/`initializeFontSize`/`initializeAutoLockTimeout`) **전부 제거**
- `loadAccounts`/`loadTemplates` 책임 이관 → RootRedirect (unlock 시점)
- `initializeTheme`/`initializeFontSize`/`initializeAutoLockTimeout` 책임 — inline script가 theme 담당 + `index.css`의 matchMedia가 fontSize/default lock 처리. **단, `initializeAutoLockTimeout`은 store에 적용하는 동작이라 useEffect 없으면 적용 안 됨** — PR 2 또는 별도 plan에서 책임 재배치. **PR 1에서는 잠재 회귀 위험으로 Verification §에 명시**
- `App`은 **라우터 + useAutoLock만** 책임 — 컴포넌트가 깨끗해지고 책임 명확

### 1-G. `src/main.tsx` — 변경 없음 (동기 createRoot 유지)

```tsx
// 현재 코드 그대로 — 변경 없음
import React from "react";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "@/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**핵심 결정:**
- Bootstrap 미도입 결정 — `main.tsx`는 동기 `createRoot` 유지
- inline FOUC script가 React mount 전 theme 결정 → main.tsx는 단순히 App mount만 책임

### 1-H. `src/pages/Home.tsx` — useEffect redirect 로직 제거 (line 34-53)

```tsx
// 제거
useEffect(() => {
  const checkFileAndNavigate = async () => {
    const sessionActiveFileName = useSessionStore.getState().activeFileName;
    if (sessionActiveFileName) {
      // ... redirect 로직 전체
    }
    await refreshFiles();
  };
  checkFileAndNavigate();
}, [navigate]);

// 유지
const refreshFiles = async () => {
  const all = await fileTable.getAllFiles();
  setFiles(all);
};

// 단순화: refreshFiles만 직접 호출
useEffect(() => {
  refreshFiles();
}, []);
```

**핵심 결정:**
- Home 본체 기능 (파일 리스트, 선택, 삭제)은 그대로 유지
- redirect 로직만 제거 — RootRedirect가 세션 분기 담당
- `/home` 직접 진입 시에도 정상 동작 (activeFileName 있는 경우의 redirect 분기는 RootRedirect가 처리)

---

## Plan-D-2 PR (themeMode + UI 3-way) — 두 번째 PR (PR 1 머지 후)

### 2-A. `src/store/settingsStore.ts` — `themeMode` + `setThemeMode` 추가 + `initializeTheme` 책임 재배치

```ts
export type ThemeMode = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export interface SettingsState {
  theme: Theme;
  themeMode: ThemeMode;  // 신규 (PR 2)
  // ... 기존
  setThemeMode: (mode: ThemeMode) => Promise<void>;  // 신규
  // ... 기존
}

function resolveTheme(mode: ThemeMode, systemDark: boolean): Theme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  html.classList.remove("light", "dark");
  html.classList.add(theme);
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: "light" as Theme,
        themeMode: "system" as ThemeMode,  // 신규 — 기본값
        // ... 기존 초기값

        // ... 기존 메서드

        setThemeMode: async (mode) => {
          const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          const newTheme = resolveTheme(mode, systemDark);
          set({ themeMode: mode, theme: newTheme });
          applyTheme(newTheme);
        },

        initializeTheme: async () => {
          // PR 2에서 책임 재배치: App.tsx useEffect에서 fire-and-forget 호출하던 것을
          // RootRedirect의 unlock 시점 또는 settingsStore의 onRehydrateStorage 콜백으로 이관 검토.
          // 본 PR은 matchMedia 시스템 모드 + live 갱신만 추가.
          const { themeMode } = get();
          if (themeMode === "system") {
            const mql = window.matchMedia("(prefers-color-scheme: dark)");
            const apply = () => {
              const newTheme = mql.matches ? "dark" : "light";
              set({ theme: newTheme });
              applyTheme(newTheme);
            };
            apply();
            mql.addEventListener("change", apply);  // live 갱신
            // cleanup은 등록 안 함 — 앱 lifetime 동안 영구 리스너
          } else {
            applyTheme(themeMode);
          }
        },

        // partialize (PR 2): themeMode 추가
        partialize: (state) => ({
          theme: state.theme,
          themeMode: state.themeMode,  // 신규
          fontSize: state.fontSize,
          autoLockTimeout: state.autoLockTimeout,
          biometricEnabled: state.biometricEnabled,
          autofillEnabled: state.autofillEnabled,
          autoBackupEnabled: state.autoBackupEnabled,
          autoBackupUri: state.autoBackupUri,
        }),
      }),
      {
        name: "kiyo-settings",
        storage: createJSONStorage(() => localStorage),
      },
    ),
    { name: "settings-store" },
  ),
);
```

### 2-B. `src/pages/Settings/components/UISection.tsx` — 3-way 토글

> **Note: merged Button API는 `label` prop 필수 (children 패턴 아님)**
>
> `src/components/Button.tsx:7-12`의 `ButtonProps`:
> ```tsx
> export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
>   label: ReactNode; // required
>   variant?: ButtonVariant;
>   ...
> };
> ```
>
> Plan-B-3 사례 (21개 inline `<button>` 마이그레이션)와 동일한 함정. 본 §의 모든
> `<Button>` 호출은 `label="..."` prop을 사용해야 `npm run typecheck` 통과.
> children으로 텍스트를 넘기면 `Property 'label' is missing` 오류 발생.

```tsx
import { useSettingsStore } from "@/store/settingsStore";
import type { ThemeMode } from "@/store/settingsStore";
import { Button } from "@/components/Button";

export function UISection() {
  const [uiMessage, setUiMessage] = useState("");
  const { theme, themeMode, setThemeMode, fontSize, setFontSize } = useSettingsStore();

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    const msg =
      mode === "light" ? "라이트 모드로 변경되었습니다."
      : mode === "dark" ? "다크 모드로 변경되었습니다."
      : "시스템 설정을 따릅니다.";
    setUiMessage(msg);
  };

  return (
    <div>
      <h3 ...>UI</h3>
      <div className="space-y-3">
        <div className="...">
          <span>테마</span>
          <div role="radiogroup" aria-label="테마 선택" className="flex gap-2">
            <Button
              variant={themeMode === "light" ? "primary" : "ghost"}
              onClick={() => handleThemeModeChange("light")}
              aria-pressed={themeMode === "light"}
              label="라이트"
            />
            <Button
              variant={themeMode === "dark" ? "primary" : "ghost"}
              onClick={() => handleThemeModeChange("dark")}
              aria-pressed={themeMode === "dark"}
              label="다크"
            />
            <Button
              variant={themeMode === "system" ? "primary" : "ghost"}
              onClick={() => handleThemeModeChange("system")}
              aria-pressed={themeMode === "system"}
              label="시스템"
            />
          </div>
        </div>
        <div className="...">
          <span>글자크기</span>
          <select ...> {/* 기존 그대로 */} </select>
        </div>
      </div>
      {uiMessage && <p ...>{uiMessage}</p>}
    </div>
  );
}
```

---

# 결정 (2026-08-30)

| Q | 결정 | 근거 |
|---|---|---|
| Q6 FOUC 가드 방식 | **`index.html` inline `<style>` + `<script>`** | React mount 전 동기 적용. inline splash DOM으로 첫 paint 시각적 일관성 + inline script의 `theme` 필드 검출로 정확한 테마 |
| Q6 SplashScreen 컴포넌트 | **신규** | `RootRedirect`의 unlock-preload 진행 중 표시. Spinner + "kiyo" 라벨. inline splash DOM은 mount 시 정리 |
| Q6 RootRedirect 구조 | **3-state machine + activeFileName/encrypted/cryptoKey 분기 + info.activeFileName stale 감지** | 2026-08-30 사용자 결정: `activeFileName === null` → `/home`, store activeFileName이 DB에 없음 (`info.activeFileName === null`) → `ErrorScreen variant="stale"`, `encrypted && !cryptoKey` → `/auth`, 그 외(unlocked 또는 plaintext) → Splash 표시하며 `loadAccounts + loadTemplates` 병렬 await → 성공 시 `/accounts` (replace), 실패 시 `ErrorScreen variant="generic"`. **2026-08-30 plan-review 추가**: `cryptoKey`는 sessionStore partial에 포함 안 됨 → `/` 직접 진입 시 `cryptoKey === null`이 보장되어 unlocked 분기는 사실상 plaintext active 직접 진입 케이스에서만 발화. Auth.tsx:91, 124의 `initializeStores()` 호출 후 `navigate("/accounts")`는 RootRedirect를 재마운트하지 않음 (`/accounts` 라우트 ≠ `/`) → 이중 preload 위험 0. plaintext `/` 직접 진입에서만 preload 발화. |
| Q-deeplink | **`/` → RootRedirect (3-state 분기), `/home` → Home (파일 선택 UI)** | 2026-08-30 사용자 결정 (갱신): RootRedirect가 `activeFileName` + `encrypted` + `cryptoKey` 조합으로 `/home` (active 없음), `/auth` (잠김), `/accounts` (preload 후) 분기 |
| Q-ActiveFile-Default | **`activeFileName === null` → `/home`** | 2026-08-30 사용자 결정: 파일 선택 UI. 새 기기/세션 만료 후 진입 또는 사용자가 명시적으로 파일 닫은 경우 (Home.tsx:55-69 handleSelectFile → clearSession → activeFileName null) |
| Q-FileInfo-Stale | **`ErrorScreen variant="stale"` 표시 (자동 복구 안 함)** | 2026-08-30 사용자 결정: store activeFileName이 DB에 없을 때 (다른 기기/탭에서 vault 삭제, Dexie corruption). 사용자가 "이 파일이 사라졌다"는 사실을 인지하도록 명시적 안내. 자동 `clearSession`은 사용자 인지 없이 store 변경 위험 → 보수적 회피. Home.tsx:55-69 handleSelectFile이 새 파일 선택 시 자연스럽게 clearSession |
| Q-no-Bootstrap | **`main.tsx`에서 await하는 Bootstrap 계층 도입 안 함** | 2026-08-30 사용자 결정: `App.tsx`의 useEffect 5개 제거, 데이터 preload는 RootRedirect가 unlock 감지 시점에 책임짐. lock 상태에선 preload 안 함 |
| Q-Error-Home-Target | **`/home`** (Home 페이지, 파일 선택 UI) | 2026-08-30 사용자 결정: 사용자가 다른 파일 선택 가능. `/`는 RootRedirect 재진입 시 무한 루프 위험 |
| Q-Inline-Script-Default | **`theme` 필드 fallback** (PR 1) | 2026-08-30 사용자 결정: PR 1은 `theme` 필드만 검사 (themeMode 부재). PR 2에서 themeMode 추가 시 inline script도 동시 갱신 (Cross-Plan Integration §) |
| Q-FOUC-Default | **stored 없으면 `<html>` 클래스 미적용 → 매치Media가 OS 따라 첫 paint** | 2026-08-30 plan-review 결정: stored에 명시 theme 없으면 inline script가 클래스를 두지 않고 `index.css:80`의 `@media (prefers-color-scheme: dark) :root:not(.light)` 매치미디어가 OS 설정을 따름. store 기본값 `theme: "light"`와의 동기화는 React mount 후 `initializeTheme()`이 처리 (PR 2의 matchMedia 시스템 모드). **잠재 깜빡임 케이스**: 사용자 OS=light + store 기본=light → 첫 paint light (매치미디어) → React mount light 적용 (동기) → 깜빡임 0. 사용자 OS=dark + store 기본=light → 첫 paint dark (매치미디어) → React mount light 적용 (store) → **다크→라이트 깜빡임 발생 가능**. PR 1 시점에는 store의 light 기본값이 명시 theme으로 해석되므로 사용자 인지 가능. PR 2에서 matchMedia 시스템 모드 도입 시 해결 (themeMode="system" 기본값 + store에 OS 추적). **단, PR 1 사용자 시나리오는 "이전 설정 없음 = 첫 진입 = 명시 light 미선택 = 시스템 의존이 자연스러운 default" → React mount 후 사용자가 Settings에서 theme 변경 가능** |
| Q6-a-1 themeMode 기본값 | **`"system"`** (신규 사용자 OS 설정 따라가기) | STRATEGY §3 "시스템 설정 연동" 직접 반영 |
| Q6 themeMode 3-way | **`"light" \| "dark" \| "system"`** | 시스템 설정 연동 + 명시 선택 둘 다 |
| Q6 시스템 live 갱신 | **`matchMedia.addEventListener("change")`** | OS 변경 실시간 감지. Capacitor lifecycle hook은 중복 — 사용자 결정: 미사용 |
| Q6 UISection UI | **3-way 버튼 (라이트/다크/시스템)** | 기존 토글 스위치(`role="switch"`) 제거. `radiogroup` + `aria-pressed` 패턴 |
| Q6 기존 `theme` 필드 | **유지** (resolved theme) | backward compatible. `themeMode`는 partialize에 추가 |
| Q6 store init 책임 재배치 | **`initializeAutoLockTimeout` 등 PR 2 또는 별도 plan** | App.tsx useEffect 5개 제거로 init 책임이 사라짐. 잠재 회귀 (autoLockTimeout reload 미적용) — Risks § 참조 |
| Q-PR-1 PR 분할 | **2 PR** | 2026-08-30 사용자 결정 (갱신): PR 1은 inline script + RootRedirect + ErrorScreen + App 단순화 + Home redirect 제거. PR 2는 themeMode + UI 3-way + inline script 동시 갱신. PR 1 → PR 2 순서 |
| Q-PR-2 Home redirect 로직 제거 범위 | **line 34-53 useEffect 전체 제거 (refreshFiles만 남김)** | 2026-08-30 사용자 결정: RootRedirect가 세션 분기 담당 |
| Q-no-inline-script | **폐기 — inline FOUC script 복원** | 2026-08-30 사용자 결정 (갱신): Bootstrap 폐기 결정에 따라 inline FOUC script 다시 채택 (목적: React mount 전 첫 paint 정확성) |

---

# Tests

## 단위 테스트 (PR별)

### PR 1 (라우트 + FOUC 가드 + RootRedirect)

| 파일 | 케이스 |
|---|---|
| `src/components/SplashScreen.test.tsx` (신규) | 렌더, index.html의 #splash DOM 정리, role="status"/aria-live 속성 |
| `src/components/ErrorScreen.test.tsx` (신규) | ① `variant="generic"` 렌더 + role="alert" 속성, ② "홈으로" 버튼 클릭 시 `/home`으로 navigate (replace), ③ `variant="stale"` 렌더 + 누락된 파일명 표시, ④ `Button`은 `label` prop 필수 (F-1) |
| `src/pages/RootRedirect.test.tsx` (신규) | **5-state 분기 검증** (총 8 케이스): ① `activeFileName=null` → `/home` navigate, ② `activeFileName=set + getFileInfo null 반환 (DB 없음)` → `ErrorScreen variant="stale"` 표시 + 누락된 파일명 표시, ③ `activeFileName=set + encrypted=true + cryptoKey=null` → `/auth` navigate, ④ `activeFileName=set + encrypted=true + cryptoKey=set + loadAccounts 성공` → `/accounts` navigate, ⑤ `activeFileName=set + encrypted=true + cryptoKey=set + loadAccounts throw` → `ErrorScreen variant="generic"` 렌더, ⑥ `activeFileName=set + encrypted=false` → preload 후 `/accounts` navigate, ⑦ unmount 시 cancelled 플래그로 setState 회피, ⑧ `fileTable.getFileInfo` throw 시 ErrorScreen. Zustand store mock은 `vi.mock("@/store/sessionStore")`로 selector 호출 검증 |
| `src/pages/Home.test.tsx` (신규) | refreshFiles 호출, redirect 로직 없음 검증 |
| `src/App.simple.test.tsx` (회귀 게이트) | App.tsx가 useEffect 5개 호출 안 함 검증 — `vi.mock()`로 store 함수들이 호출되지 않았는지 spy. PR 1 단순화로 인해 App은 Router + useAutoLock만 책임 |

### PR 2 (themeMode + UI)

| 파일 | 케이스 |
|---|---|
| `src/store/settingsStore.test.ts` (신규 또는 확장) | themeMode set (light/dark/system), 시스템 변경 시 resolved theme 갱신. matchMedia mock 필요 (vi.stubGlobal) |
| `src/pages/Settings/components/UISection.test.tsx` (신규) | 3-way 버튼 렌더, 클릭 시 setThemeMode 호출, aria-pressed 상태 |

## Playwright E2E (PR 1 + PR 2 통합 검증, PR 1 머지 후 PR 2 머지 전 1차 검증)

| 시나리오 | 검증 | PR |
|---|---|---|
| 1. dark 모드 설정 → 앱 재시작 | 첫 paint dark (inline script 적용), 깜빡임 없음, SplashScreen 잠깐 표시 후 `/accounts` (unlock) 또는 `/auth` (lock) | PR 1 |
| 2. session 없음 (activeFileName=null) → 앱 진입 | `/` → RootRedirect → `/home` (파일 선택 UI) | PR 1 |
| 3. activeFileName set + cryptoKey null (잠긴 상태) → 앱 진입 | `/` → RootRedirect → `/auth` (PIN 입력) | PR 1 |
| 4. `/home` 직접 진입 | Home 렌더링, redirect 없음 | PR 1 |
| 5. unlock 상태 + preload 실패 (Dexie corrupt) | SplashScreen 잠깐 → ErrorScreen (variant="generic") 표시 → "홈으로" 버튼 클릭 → `/home` | PR 1 |
| 6. `/auth` → unlock 성공 → `/accounts` 직접 navigate | RootRedirect 재마운트 없이 Accounts 페이지 표시. Auth 페이지가 `navigate("/accounts", { replace: true })` 호출 | PR 1 |
| 7. 다른 기기에서 active vault 삭제 후 진입 | store `activeFileName` set이지만 `fileTable.getFileInfo`가 null 반환 → ErrorScreen (variant="stale") 표시 + 누락된 파일명 노출 → "홈으로" 버튼 클릭 → `/home` | PR 1 |
| 8. system 모드 + OS dark → 앱 재시작 | 첫 paint dark (theme fallback이 OS 색상 사용), SplashScreen 표시 후 `/accounts` (unlock) 또는 `/auth` | PR 2 |
| 9. themeMode 변경 (system → light) | 즉시 light 토큰 적용 | PR 2 |

## Android E2E

- **변경 없음** — Plan-D는 React 측 한정
- `compileDebugKotlin` + `testDebugUnitTest` 회귀 게이트만

## 회귀 게이트 (각 PR)

- `npm run typecheck` 통과
- `npm run lint` 통과 (신규 0 에러)
- `npm run test` 통과 (신규/확장 테스트 포함)
- `npm run build` 통과
- Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- 사용자가 Playwright E2E 직접 실행 시 FOUC 0 + 회귀 0

---

# Risks

| 리스크 | 완화 |
|---|---|
| inline script의 zustand persist storage 구조 의존 | script의 파싱 로직을 store schema와 함께 갱신. PR 1은 `theme` 필드 fallback만 사용 (themeMode 부재 시) — Cross-Plan Integration § 참조 |
| inline splash DOM과 React SplashScreen의 이중 splash | SplashScreen mount 시 `document.getElementById("splash")?.remove()` 호출 (1-B 코드). PR 2에서 themeMode 도입 시 inline script도 동시 갱신 |
| App.tsx useEffect 5개 제거 시 store init 회귀 | `initializeFontSize`는 `settingsStore.onRehydrateStorage` 콜백으로 이관 — `<html>` font-size 클래스 적용이 persist hydrate 직후 자동 실행됨 (회귀 0). `initializeAutoLockTimeout`은 no-op mark 호출뿐이라 이관 불필요. `initializeTheme`은 PR 2에서 matchMedia 시스템 모드와 함께 재설계. inline script가 첫 paint theme 결정 → PR 1 시점에 React theme side effect 불필요 |
| Home에서 redirect 로직 제거 시 회귀 | multi-vault 결과(file 리스트) 자체는 보존, redirect만 이관. Playwright E2E 회귀 검증 (시나리오 3) |
| `/` → `/accounts` (또는 `/auth`) 변경으로 기존 deep-link 깨짐 | RootRedirect가 `/`을 `/accounts`(unlock) 또는 `/auth`(lock)로 보내고, `/home`은 파일 선택 UI로 직접 접근 가능. 외부 호환 OK |
| `RootRedirect`의 3-state machine race | `redirecting` (target 포함) / `preloading` / `error` + raw `info: ActiveFileInfo` 보관. wrapper state 제거로 stale 분기는 `info.activeFileName === null` 단일 검사. `cancelled` 플래그로 async effect unmount 시 setState 회피. Zustand selector 패턴 — `useSessionStore((s) => s.activeFileName)`으로 컴포넌트가 store 의존성을 React에 선언. 단위 테스트 (Tests § PR 1) |
| `ErrorScreen variant="stale"` UX 부담 — 사용자가 매번 activeFileName 사라질 때마다 안내 화면 봐야 함 | Q-FileInfo-Stale-a의 trade-off. 자동 복구 대비 디버깅/투명성 우선. 발생 빈도 낮음 (다른 기기에서 동시 사용, Dexie corruption 등) — 사용자가 한 번 안내 보면 다음 진입부터 정상 |
| `loadAccounts`/`loadTemplates`가 unlock 직전에 stale data 반환 | unlock 후 `setupVaultSession({ loadStores: true })` 패턴이 이미 accountStore에 적용되어 있을 가능성 (PR 7a 참고). RootRedirect의 preload 순서가 잘못되면 stale data → 사용자가 `/accounts`에서 옳지 않은 데이터 봄. **2026-08-30 plan-review 검증**: `cryptoKey`는 sessionStore partial 대상 아님 (`partialize` line 96-101에 cryptoKey 없음) → `/` 직접 진입 시 `cryptoKey === null`이 항상 참. 따라서 `unlocked 분기(preload)`는 plaintext active의 `/` 직접 진입 케이스에서만 발화. Auth.tsx:91, 124가 unlock/biometric 후 `initializeStores()` 호출 후 `navigate("/accounts")`로 직접 이동하므로 RootRedirect가 다시 마운트되지 않음 → 이중 preload 위험 0. **Verification § 추가 항목**: "Auth.tsx unlock 후 `/accounts` 직접 navigate 시 RootRedirect 마운트 0 + preload 발화 0" 단언 |
| `RootRedirect`가 잠긴 상태(activeFileName set + cryptoKey null)에서 `/auth` navigate 후 사용자가 unlock하면 RootRedirect 재마운트 없이 accounts 진입 필요 | `/auth` 페이지가 unlock 완료 시 `navigate("/accounts", { replace: true })` 직접 호출하면 됨. RootRedirect는 `/` 직접 진입 시점에만 동작. **verification §에서 `/auth → unlock → /accounts` 직접 navigate 시나리오 확인** |
| RootRedirect의 `fileTable.getFileInfo` 호출 race — activeFileName 변경 vs fileInfo effect 발화 | `activeFileName` Zustand selector가 re-render 트리거 → effect 1 의존성 `[activeFileName]`으로 fileInfo 재조회. effect 2는 `[activeFileName, fileInfo, cryptoKey, status.kind]`로 모든 의존성 추적. cancelled 플래그로 unmount 시 setState 회피 |
| matchMedia 리스너 누수 | `initializeTheme`에서 등록된 리스너는 영구 (앱 lifetime). cleanup 추가는 별도 plan |
| UISection 3-way 토글이 기존 2-way 토글 스위치와 다른 UX | 첫 paint 후 즉시 토글 가능, `aria-pressed` 시맨틱 |
| UISection `<Button>` 호출 시 children 패턴으로 작성 → typecheck 실패 (F-1) | Plan-D-2 §2-B에 Note 추가 — `label="..."` prop 필수. Plan-B-3 21사례와 동일 함정 |
| PR 2가 PR 1에 의존 (`/accounts` 라우트 + RootRedirect 패턴) | PR 1 머지 후 PR 2 진행. PR 2 단독 머지 불가 |

---

# Out of Scope (후속)

- **컬러 팔레트 변경** — 색상 토큰 재설계, contrast ratio 자동 측정
- **a11y audit**: UISection 3-way 토글의 키보드 네비게이션, focus 순서 점검
- **테마 transition 애니메이션**: CSS transition으로 부드러운 전환
- **고대비 모드** (high contrast): 별도 plan
- **Capacitor lifecycle hook**: themeMode 변경 시 앱 resume 시점 강제 갱신 (현재는 matchMedia만 사용)

---

# Cross-Plan Integration

**Upstream (이 plan이 의존):**
- ✅ Plan-A2 (`<Spinner>` 컴포넌트 — SplashScreen에서 사용. **import 경로 주의**: `src/components/feedback/Spinner.tsx`, `@/components/Spinner` 아님 — Plan-D-1 §1-B 참조)
- ✅ Plan-B-3 (`<Button>` 컴포넌트 — ErrorScreen과 UISection에서 사용. **API 주의**: `label: ReactNode` required prop — Plan-D-1 §1-D, Plan-D-2 §2-B F-1 Note 참조)

**Downstream (이 plan이 제공):**
- **a11y audit plan**: UISection 3-way 토글 + `radiogroup` 패턴 점검, focus 순서, ErrorScreen `role="alert"` 시맨틱 검증
- **컬러 팔레트 plan (후속)**: themeMode 인프라 활용
- **Home 진입점 표준화** — 이후 모든 plan이 `/` 직접 참조 대신 적절한 페이지 사용
- **store init 책임 재배치 plan (잠재 후속)**: App.tsx에서 제거된 `initializeAutoLockTimeout` 등 store init 호출의 책임 재배치 (`onRehydrateStorage` 또는 RootRedirect unlock 시점 이관)

**zustand persist schema 동기화 (인라인 script ↔ settingsStore):**

> **Warning: `index.html` inline FOUC script는 settingsStore의 zustand persist schema와 강하게 결합됨**

PR 1 시점:
- `kiyo-settings` localStorage 키의 `state` 객체는 `theme`/`fontSize`/`autoLockTimeout`/`biometricEnabled`/`autofillEnabled`/`autoBackupEnabled`/`autoBackupUri` 7개 필드만 포함 (현재 settingsStore.ts:140-148 partialize 그대로)
- inline script는 `parsed.state.theme`을 검사하여 `dark`/`light` 적용 — **PR 1의 `theme` 필드 fallback** (Q-Inline-Script-Default-b)

PR 2 머지 후:
- partialize에 `themeMode` 추가 (Plan-D-2 §2-A)
- inline script의 검출 로직을 `themeMode` 우선 + `theme` fallback으로 확장 필요
- **migration 추가 시 (zustand persist version bump)** inline script도 함께 갱신 필요. 별도 plan에서 zod/schema 검증 추가 시 inline script 파싱 로직도 함께 강화

체크리스트:
- [x] PR 1 머지: inline script의 `theme` 필드 fallback 사용 — `themeMode` 부재 시 light/dark 기본값. **현재 plan에서 결정 완료** (Q-Inline-Script-Default-b)
- [ ] PR 2 머지: inline script의 `themeMode` 검출 로직 + settingsStore partialize + `initializeTheme`의 `system` 분기 3곳 동기화 검증
- [ ] 향후 zustand persist version 추가 시 inline script + store schema + migration 동시 갱신

**호환 시그니처:**
- `theme: "light" | "dark"` (resolved, 기존 그대로)
- `themeMode: "light" | "dark" | "system"` (PR 2 신규, partialize에 추가)
- `setThemeMode(mode: ThemeMode)` (PR 2 신규)
- 라우트 변경 (PR 1): `/` → RootRedirect, `/home` → Home (신규), 나머지 그대로

---

# Verification Checklist

## PR 1 (라우트 + FOUC 가드 + RootRedirect) 완료 시

- [ ] `index.html` inline `<style>` + `<script>` 추가 — stored theme 있을 때만 `<html class>` 적용, stored 없으면 매치미디어에 위임 (FOUC 0)
- [ ] `SplashScreen.tsx` 신규 — index.html의 #splash DOM 정리, `role="status"`, `aria-live="polite"`. `import { Spinner } from "@/components/feedback/Spinner"` 확인 (F-2)
- [ ] `ErrorScreen.tsx` 신규 — `variant: "generic" | "stale"` Discriminated union. generic = preload 실패, stale = activeFileName이 DB에 없을 때. `role="alert"`, `aria-live="assertive"`, `홈으로` 버튼 (Plan-B-3 `<Button label="..." />` API 준수, F-1)
- [ ] `RootRedirect.tsx` 신규 — 3-state machine (`redirecting`/`preloading`/`error`) + `info: ActiveFileInfo` raw 보관 + `activeFileName`/`encrypted`/`cryptoKey` 분기 + `info.activeFileName === null`로 stale 감지 + Zustand selector + cancelled 플래그
- [ ] `settingsStore.ts` — `onRehydrateStorage` 콜백으로 `initializeFontSize` side effect 이관 (App.tsx useEffect 5개 제거 후 font-size reload 회귀 0). PR 1은 `initialize*` 메서드 시그니처 그대로 유지
- [ ] `App.tsx` useEffect 5개 제거 (`loadAccounts`/`loadTemplates`/`initializeTheme`/`initializeFontSize`/`initializeAutoLockTimeout` 호출 삭제). 라우트는 `/` → RootRedirect, `/home` → Home
- [ ] `Home.tsx` line 34-53 redirect 로직 제거 — refreshFiles만 유지
- [ ] `main.tsx` — 변경 없음 (동기 `createRoot` 유지)
- [ ] 신규 단위 테스트 4개 파일 통과 (`SplashScreen`, `ErrorScreen`, `RootRedirect`, `Home`)
- [ ] 회귀 게이트: `App.simple.test.tsx` — App이 useEffect 5개를 호출하지 않음 (vi.mock으로 store 함수 spy)
- [ ] Playwright E2E PR 1 시나리오 통과 (1, 2, 3, 4, 5, 6, 7)
- [ ] **Plan-review 추가**: Auth.tsx unlock/biometric 성공 후 `navigate("/accounts", { replace: true })` 직접 호출 → RootRedirect 재마운트 0, preload 발화 0 검증 (unit: `RootRedirect.test.tsx` 케이스 ⑨)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과 (신규 0 에러)
- [ ] `npm run test` 전체 통과
- [ ] `npm run build` 통과
- [ ] Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] 사용자가 Playwright E2E 직접 실행 시 FOUC 0 + 회귀 0 + ErrorScreen 표시 동작 확인

## PR 2 (themeMode + UI) 완료 시

- [ ] `settingsStore.ts`에 `themeMode` + `setThemeMode` 추가 + `initializeTheme` 확장 (`matchMedia` 시스템 모드 + live 갱신). **단, `initializeTheme`의 책임 재배치는 PR 2 범위 밖 — 별도 plan (Risks § 참조)**
- [ ] `index.html` inline script 동시 갱신 — `themeMode` 검출 로직 + `theme` fallback (Cross-Plan Integration § 체크리스트)
- [ ] `UISection.tsx` 3-way 토글 (라이트/다크/시스템) — 기존 토글 스위치 제거. **모든 `<Button>` 호출이 `label="..."` prop 필수** (F-1, §2-B Note 참조)
- [ ] **Plan-review 추가**: PR 2에서 추가되는 `matchMedia("change")` 리스너는 `initializeTheme` 내부에서 영구 등록. PR 2 검증 게이트에 "리스너 등록 후 unmount 시 cleanup 단언" 또는 "앱 lifetime 등록임을 명시하고 다음 plan으로 이관" 결정 명시. 단언 추가 시 `settingsStore.test.ts`에 cleanup 단언 1건 포함
- [ ] 신규/확장 단위 테스트 2개 파일 통과 (`settingsStore`, `UISection`)
- [ ] Playwright E2E PR 2 시나리오 통과 (8, 9)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과 (신규 0 에러)
- [ ] `npm run test` 전체 통과
- [ ] `npm run build` 통과
- [ ] Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] 사용자가 Playwright E2E 직접 실행 시 FOUC 0 + 회귀 0

---

# 사용자 결정 대기 항목 (2026-08-30)

**현재 결정 대기 항목 없음.** 다음 항목들은 사용자 결정 완료:

- ✅ Q6 FOUC 가드 방식 — `index.html` inline `<style>` + `<script>` (`theme` 필드 fallback)
- ✅ Q6 SplashScreen + RootRedirect + ErrorScreen 도입
- ✅ Q6 `/` 라우트 리팩토링 (`/` → RootRedirect, `/home` → Home, unlock 시 `/accounts`)
- ✅ Q-deeplink — RootRedirect가 `activeFileName`+`encrypted`+`cryptoKey` 조합으로 `/home`/`/auth`/`/accounts` 분기
- ✅ Q-ActiveFile-Default — `activeFileName === null` → `/home`
- ✅ Q-FileInfo-Stale — `ErrorScreen variant="stale"` 표시 (자동 복구 안 함, 사용자 명시적 복구)
- ✅ Q-no-Bootstrap — main.tsx Bootstrap 계층 도입 안 함
- ✅ Q-Error-Home-Target — ErrorScreen의 "홈으로" → `/home`
- ✅ Q-Inline-Script-Default — `theme` 필드 fallback (PR 1)
- ✅ Q6-a-1 themeMode 기본값 — `"system"`
- ✅ Q6 시스템 live 갱신 — `matchMedia`만 (Capacitor lifecycle 미사용)
- ✅ Q6 UISection UI — 3-way 버튼
- ✅ Q6 store init 책임 재배치 — PR 2 또는 별도 plan (Risks §)
- ✅ Q-PR-1 PR 분할 — 2 PR (라우트+FOUC / themeMode+UI)
- ✅ Q-PR-2 Home redirect 로직 제거 범위 — line 34-53 전체 제거
- ✅ Q-no-inline-script — 폐기 (inline FOUC script 복원)

Plan-D는 결정 완료 상태. 작업 시작 준비.