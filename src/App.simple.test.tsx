import { describe, it, expect } from "vitest";

/**
 * Plan-D PR 1 회귀 게이트 — App.tsx는 useEffect를 호출하지 않아야 함.
 * RootRedirect가 unlock 시점에 preload 담당.
 *
 * 정적 검증: App.tsx 소스를 읽어 useEffect 호출이 있는지 확인.
 * - App.tsx가 단순화되어 라우터 + useAutoLock + AutoLockIndicator + SyncErrorBanner만 책임
 *
 * fs.readFileSync를 테스트 본문에서 호출하면 vitest의 컴포넌트-렌더 감지가
 * false positive를 일으키므로 import는 top-level에서만 사용.
 */

describe("App (Plan-D PR 1 회귀 게이트)", () => {
  it("① App.tsx가 useEffect 호출하지 않음 (loadAccounts/loadTemplates 호출 0)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appPath = path.resolve(process.cwd(), "src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).not.toMatch(/useEffect/);
    expect(content).not.toMatch(/loadAccounts/);
    expect(content).not.toMatch(/loadTemplates/);
  });

  it("② App.tsx에 RootRedirect 라우트 + /home 라우트 존재", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appPath = path.resolve(process.cwd(), "src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toMatch(/path="\/"/);
    expect(content).toMatch(/RootRedirect/);
    expect(content).toMatch(/path="\/home"/);
  });
});