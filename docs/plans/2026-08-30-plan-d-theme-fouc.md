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

**앱 진입 시 첫 paint의 깜빡임(FOUC)을 제거**하고, **`/` 라우트를 redirect 전용 entry로 분리**하며, **시스템 설정 연동**(시스템 다크/라이트 따라가기 + live 갱신)을 추가한다.

완료 시 다음이 참:
- `index.html`에 inline splash HTML (FOUC 가드) — React mount 전 light/dark 토큰 결정
- `SplashScreen` 컴포넌트 신규 — 초기화 중 표시
- `RootRedirect` 컴포넌트 신규 — `initialized` 게이트 + `unlocked` 게이트로 `/auth` 또는 `/home`으로 navigate
- `/` 라우트가 `RootRedirect`로 변경, 기존 `Home`은 `/home`으로 이동
- `Home` 내부의 "redirect 로직" (line 34-53 useEffect) 제거 — RootRedirect가 담당
- 시스템 설정(prefers-color-scheme) 자동 감지 — `themeMode: "light" | "dark" | "system"` 추가
- 시스템 설정 변경 시 live 갱신 (`matchMedia` 리스너)
- UISection UI: 3-way 토글(라이트/다크/시스템)

**PR 분할 (2026-08-30 사용자 결정):**
- **PR 1 — 라우트 + FOUC 가드** (라우트 변경 + inline script + SplashScreen/RootRedirect 신규 + `initialized` 게이트)
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
| `index.html` | inline script **없음** | 첫 paint 시 FOUC 가드 부재 — light 토큰으로 시작, React mount 후 dark 토큰 적용 시 깜빡임 |
| `src/main.tsx` | `createRoot(...).render(<StrictMode><App /></StrictMode>)` | React mount 시점 |
| `src/App.tsx` line 41-43 | `useEffect`에서 `initializeTheme()` 호출 | React mount 후 적용 → 깜빡임 가능 |
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

## Home의 이중 역할 문제

- `/` 진입 → Home 렌더링 → Home이 session 확인 후 redirect → `/auth` 또는 `/accounts`
- 짧더라도 Home 화면(파일 리스트)이 잠깐 보였다가 사라지는 flash 가능
- multi-vault로 Home이 실제 페이지 역할을 가지게 되면서 충돌
- **해결**: `/`은 RootRedirect 전용, Home은 `/home`으로 이동

---

# Proposed Changes

## Plan-D-1 PR (라우트 + FOUC 가드) — 첫 번째 PR

### 1-A. `index.html` — inline splash HTML + script

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
          var sysDark = window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
          var stored = null;
          try { stored = localStorage.getItem("kiyo-settings"); } catch (e) {}
          var mode = "system";  // 기본
          if (stored) {
            try {
              var parsed = JSON.parse(stored);
              var s = parsed && parsed.state ? parsed.state : parsed;
              if (s && (s.themeMode === "light" || s.themeMode === "dark" || s.themeMode === "system")) {
                mode = s.themeMode;
              }
            } catch (e) {}
          }
          var apply = mode === "system" ? (sysDark ? "dark" : "light") : mode;
          var html = document.documentElement;
          html.classList.remove("light", "dark");
          html.classList.add(apply);
        } catch (e) {
          document.documentElement.classList.add("light");
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
- inline `<style>` + `<script>` — React mount 전 동기 적용 보장
- zustand persist storage 구조 (`{ state: { themeMode, ... }, version: N }`) 파싱 — store schema 변경 시 이 script도 함께 갱신 필요
- `try/catch`로 localStorage 접근 실패(SSR/disabled) 대비
- `<div id="splash">` — React mount 후 SplashScreen이 root를 덮으면 splash DOM은 SplashScreen이 정리

### 1-B. `src/components/SplashScreen.tsx` (신규)

```tsx
import { useEffect } from "react";
import { Spinner } from "@/components/Spinner";

/**
 * 초기화 중 표시되는 splash. themeMode에 따라 light/dark 변형.
 * React mount 직후 splash DOM (index.html의 #splash)을 정리.
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
import { Navigate } from "react-router-dom";
import { SplashScreen } from "@/components/SplashScreen";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * `/` 진입점 — 초기화/세션 상태에 따라 redirect.
 *
 *   - initialized === false  → SplashScreen (Zustand hydrate + loadAccounts 대기)
 *   - initialized === true && cryptoKey === null  → /auth
 *   - initialized === true && cryptoKey !== null  → /home
 */
export function RootRedirect() {
  const initialized = useSettingsStore((s) => s.initialized);
  const cryptoKey = useSessionStore((s) => s.cryptoKey);

  if (!initialized) {
    return <SplashScreen />;
  }

  return <Navigate to={cryptoKey ? "/home" : "/auth"} replace />;
}
```

**핵심 결정:**
- `initialized` 게이트 — Zustand persist hydrate 완료 + `loadAccounts`/`loadTemplates`/`initializeTheme` 완료 시점
- `cryptoKey` 게이트 — PIN 인증 후 unlock된 상태인지 확인
- `/auth`로 보내는 경우: 세션은 있지만 lock 상태 (PIN 재입력 필요)
- `/home`으로 보내는 경우: 활성 파일 있고 unlock된 상태 — 파일 리스트 표시

### 1-D. `src/store/settingsStore.ts` — `initialized` 추가 (PR 1은 themeMode 미포함)

PR 1 범위: `initialized` 게이트만 추가. `themeMode`는 PR 2에서 추가.

```ts
export interface SettingsState {
  initialized: boolean;  // 신규 — hydrate + initialize 완료 게이트 (PR 1)
  theme: Theme;
  // themeMode는 PR 2에서 추가
  // ... 기존 필드
  setInitialized: (initialized: boolean) => void;
  // ... 기존 메서드
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        initialized: false,
        theme: "light" as Theme,
        // ... 기존 초기값

        setInitialized: (initialized) => set({ initialized }),

        // initializeTheme(), setTheme(), toggleTheme()는 PR 1에서 동작 유지
        // themeMode 분기(matchMedia 등)는 PR 2에서 추가

        // partialize (PR 1): initialized는 persist 안 함 (메모리만)
        // themeMode는 PR 2에서 partialize에 추가
        // ... 기존 partialize 그대로
      }),
      {
        name: "kiyo-settings",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // 기존 부분 그대로 — initialized/themeMode 제외
          theme: state.theme,
          fontSize: state.fontSize,
          autoLockTimeout: state.autoLockTimeout,
          biometricEnabled: state.biometricEnabled,
          autofillEnabled: state.autofillEnabled,
          autoBackupEnabled: state.autoBackupEnabled,
          autoBackupUri: state.autoBackupUri,
        }),
      },
    ),
    { name: "settings-store" },
  ),
);
```

### 1-E. `src/App.tsx` — 라우트 + 초기화 시퀀스

```tsx
function App() {
  const { remainingSeconds } = useAutoLock();
  const loadAccounts = useAccountStore((state) => state.loadAccounts);
  const loadTemplates = useTemplateStore((state) => state.loadTemplates);
  const initializeTheme = useSettingsStore((state) => state.initializeTheme);
  const initializeFontSize = useSettingsStore((state) => state.initializeFontSize);
  const initializeAutoLockTimeout = useSettingsStore((state) => state.initializeAutoLockTimeout);
  const setInitialized = useSettingsStore((state) => state.setInitialized);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadAccounts(),
      loadTemplates(),
      initializeTheme(),
      initializeFontSize(),
      initializeAutoLockTimeout(),
    ]).finally(() => {
      if (!cancelled) setInitialized(true);
    });
    return () => { cancelled = true; };
  }, [loadAccounts, loadTemplates, initializeTheme, initializeFontSize, initializeAutoLockTimeout, setInitialized]);

  return (
    <BrowserRouter>
      <AndroidBackButtonHandler />
      <Routes>
        {/* `/` → RootRedirect (Splash → /auth 또는 /home) */}
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
- `Promise.all([...])`로 5개 초기화 병렬 실행 → 모두 끝나면 `setInitialized(true)`
- `cancelled` 플래그로 unmount 시 setState 회피
- `initialized`는 메모리만 (persist 안 함) — 앱 재시작마다 false → true로 게이트
- RootRedirect가 `initialized === false`면 SplashScreen 표시 → React mount 후 즉시 splash (FOUC 0)

### 1-F. `src/pages/Home.tsx` — useEffect redirect 로직 제거 (line 34-53)

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

### 2-A. `src/store/settingsStore.ts` — `themeMode` + `setThemeMode` 추가 + `initializeTheme` 확장

```ts
export type ThemeMode = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export interface SettingsState {
  initialized: boolean;  // PR 1에서 추가
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
        initialized: false,
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
            >
              라이트
            </Button>
            <Button
              variant={themeMode === "dark" ? "primary" : "ghost"}
              onClick={() => handleThemeModeChange("dark")}
              aria-pressed={themeMode === "dark"}
            >
              다크
            </Button>
            <Button
              variant={themeMode === "system" ? "primary" : "ghost"}
              onClick={() => handleThemeModeChange("system")}
              aria-pressed={themeMode === "system"}
            >
              시스템
            </Button>
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
| Q6 FOUC 가드 방식 | **index.html inline `<style>` + `<script>`** | React mount 전 동기 적용. inline splash DOM으로 첫 paint 시각적 일관성 |
| Q6 SplashScreen 컴포넌트 | **신규** | `initialized === false` 시 표시. Spinner + "kiyo" 라벨 |
| Q6 RootRedirect 구조 | **`/`은 redirect 전용, Home은 `/home`으로 이동** | 2026-08-30 사용자 결정: `/` → RootRedirect → Splash → `/auth` 또는 `/home`. 기존 Home의 redirect 로직 제거 |
| Q-deeplink | **`/` → RootRedirect, `/home` → Home 모두 Home 렌더** | 2026-08-30 사용자 결정: (a). RootRedirect가 `/`을 `/home`로 보냄, `/home` 직접 진입도 Home 렌더. 일관성 + 외부 호환 모두 OK |
| Q6-a-1 themeMode 기본값 | **`"system"`** (신규 사용자 OS 설정 따라가기) | STRATEGY §3 "시스템 설정 연동" 직접 반영 |
| Q6 themeMode 3-way | **`"light" \| "dark" \| "system"`** | 시스템 설정 연동 + 명시 선택 둘 다 |
| Q6 시스템 live 갱신 | **`matchMedia.addEventListener("change")`** | OS 변경 실시간 감지. Capacitor lifecycle hook은 중복 — 사용자 결정: 미사용 |
| Q6 UISection UI | **3-way 버튼 (라이트/다크/시스템)** | 기존 토글 스위치(`role="switch"`) 제거. `radiogroup` + `aria-pressed` 패턴 |
| Q6 기존 `theme` 필드 | **유지** (resolved theme) | backward compatible. `themeMode`는 partialize에 추가 |
| Q6 `initialized` 위치 | **`useSettingsStore`** | theme/font/lock/backup 한 곳에 통합 (앱 전역 hydration 게이트) |
| Q-PR-1 PR 분할 | **2 PR** | 2026-08-30 사용자 결정: (b). PR 1은 라우트 변경 + inline script = 회귀 위험 → 단독 검증 가치. PR 2는 settingsStore schema + UI 3-way. PR 1 → PR 2 순서 |
| Q-PR-2 Home redirect 로직 제거 범위 | **line 34-53 useEffect 전체 제거 (refreshFiles만 남김)** | 2026-08-30 사용자 결정: (a). RootRedirect가 세션 분기 담당 |

---

# Tests

## 단위 테스트 (PR별)

### PR 1 (라우트 + FOUC 가드)

| 파일 | 케이스 |
|---|---|
| `src/components/SplashScreen.test.tsx` (신규) | 렌더, index.html의 #splash DOM 제거 |
| `src/pages/RootRedirect.test.tsx` (신규) | initialized=false → SplashScreen, initialized=true + cryptoKey=null → /auth, initialized=true + cryptoKey !== null → /home. Navigate mock |
| `src/pages/Home.test.tsx` (신규) | refreshFiles 호출, redirect 로직 없음 검증 |

### PR 2 (themeMode + UI)

| 파일 | 케이스 |
|---|---|
| `src/store/settingsStore.test.ts` (신규 또는 확장) | themeMode set (light/dark/system), 시스템 변경 시 resolved theme 갱신. matchMedia mock 필요 (vi.stubGlobal) |
| `src/pages/Settings/components/UISection.test.tsx` (신규) | 3-way 버튼 렌더, 클릭 시 setThemeMode 호출, aria-pressed 상태 |

## Playwright E2E (PR 1 + PR 2 통합 검증, PR 1 머지 후 PR 2 머지 전 1차 검증)

| 시나리오 | 검증 | PR |
|---|---|---|
| 1. dark 모드 설정 → 앱 재시작 | 첫 paint dark, 깜빡임 없음, SplashScreen 잠깐 표시 후 `/home` | PR 1 |
| 2. session 없음 → 앱 진입 | `/` → SplashScreen → `/auth` | PR 1 |
| 3. `/home` 직접 진입 | Home 렌더링, redirect 없음 | PR 1 |
| 4. system 모드 + OS dark → 앱 재시작 | 첫 paint dark, `/home` | PR 2 |
| 5. themeMode 변경 (system → light) | 즉시 light 토큰 적용 | PR 2 |

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
| inline script의 zustand persist storage 구조 의존 | script의 파싱 로직을 store schema와 함께 갱신. zod/schema 검증 추가는 별도 plan |
| inline splash DOM과 React SplashScreen의 이중 splash | SplashScreen mount 시 `document.getElementById("splash")?.remove()` 호출 |
| Home에서 redirect 로직 제거 시 회귀 | multi-vault 결과(file 리스트) 자체는 보존, redirect만 이관. Playwright E2E 회귀 검증 |
| `/` → `/home` 변경으로 기존 deep-link 깨짐 | 사용자 결정 (a): RootRedirect가 `/`을 `/home`으로 보내고, `/home` 직접 진입도 Home 렌더 |
| `initialized` 게이트가 무한 로딩 가능 | `Promise.all([...]).finally()`로 무조건 true. 안전망 |
| matchMedia 리스너 누수 | `initializeTheme`에서 등록된 리스너는 영구 (앱 lifetime). cleanup 추가는 별도 plan |
| UISection 3-way 토글이 기존 2-way 토글 스위치와 다른 UX | 첫 paint 후 즉시 토글 가능, `aria-pressed` 시맨틱 |
| PR 2가 PR 1에 의존 (RootRedirect의 `initialized` 게이트 사용) | PR 1 머지 후 PR 2 진행. PR 2 단독 머지 불가 |

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
- ✅ Plan-A2 (`<Spinner>` 컴포넌트 — SplashScreen에서 사용)

**Downstream (이 plan이 제공):**
- **a11y audit plan**: UISection 3-way 토글 + `radiogroup` 패턴 점검, focus 순서
- **컬러 팔레트 plan (후속)**: themeMode 인프라 활용
- **Home 진입점 표준화** — 이후 모든 plan이 `/` 직접 참조 대신 `/home` 또는 적절한 페이지 사용

**호환 시그니처:**
- `theme: "light" | "dark"` (resolved, 기존 그대로)
- `themeMode: "light" | "dark" | "system"` (PR 2 신규, partialize에 추가)
- `initialized: boolean` (PR 1 신규, 메모리만)
- `setThemeMode(mode: ThemeMode)` (PR 2 신규)
- `setInitialized(initialized: boolean)` (PR 1 신규)
- 라우트 변경 (PR 1): `/` → RootRedirect, `/home` → Home (신규), 나머지 그대로

---

# Verification Checklist

## PR 1 (라우트 + FOUC 가드) 완료 시

- [ ] `index.html` inline splash `<style>` + `<script>` 추가
- [ ] `SplashScreen.tsx` 신규 (index.html의 #splash DOM 정리)
- [ ] `RootRedirect.tsx` 신규 (initialized + cryptoKey 게이트)
- [ ] `settingsStore.ts`에 `initialized` + `setInitialized` 추가 (themeMode는 PR 2)
- [ ] `App.tsx` 라우트 변경 (`/` → RootRedirect, `/home` → Home) + `Promise.all` 초기화 + `setInitialized(true)`
- [ ] `Home.tsx` line 34-53 redirect 로직 제거
- [ ] 신규 단위 테스트 3개 파일 통과 (`SplashScreen`, `RootRedirect`, `Home`)
- [ ] Playwright E2E PR 1 시나리오 통과 (1, 2, 3)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과 (신규 0 에러)
- [ ] `npm run test` 전체 통과
- [ ] `npm run build` 통과
- [ ] Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] 사용자가 Playwright E2E 직접 실행 시 FOUC 0 + 회귀 0

## PR 2 (themeMode + UI) 완료 시

- [ ] `settingsStore.ts`에 `themeMode` + `setThemeMode` 추가 + `initializeTheme` 확장 (`matchMedia`)
- [ ] `UISection.tsx` 3-way 토글 (라이트/다크/시스템) — 기존 토글 스위치 제거
- [ ] 신규/확장 단위 테스트 2개 파일 통과 (`settingsStore`, `UISection`)
- [ ] Playwright E2E PR 2 시나리오 통과 (4, 5)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과 (신규 0 에러)
- [ ] `npm run test` 전체 통과
- [ ] `npm run build` 통과
- [ ] Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] 사용자가 Playwright E2E 직접 실행 시 FOUC 0 + 회귀 0

---

# 사용자 결정 대기 항목 (2026-08-30)

**현재 결정 대기 항목 없음.** 다음 항목들은 사용자 결정 완료:

- ✅ Q6 FOUC 가드 방식 — inline `<style>` + `<script>`
- ✅ Q6 SplashScreen + RootRedirect 도입
- ✅ Q6 `/` 라우트 리팩토링 (`/` → RootRedirect, `/home` → Home)
- ✅ Q-deeplink — RootRedirect가 `/` → `/home` 처리
- ✅ Q6-a-1 themeMode 기본값 — `"system"`
- ✅ Q6 시스템 live 갱신 — `matchMedia`만 (Capacitor lifecycle 미사용)
- ✅ Q6 UISection UI — 3-way 버튼
- ✅ Q-PR-1 PR 분할 — 2 PR (라우트+FOUC / themeMode+UI)
- ✅ Q-PR-2 Home redirect 로직 제거 범위 — line 34-53 전체 제거

Plan-D는 결정 완료 상태. 작업 시작 준비.