import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SplashScreen } from "@/components/SplashScreen";

describe("SplashScreen (Plan-D PR 1)", () => {
  beforeEach(() => {
    // 각 테스트마다 inline splash DOM을 새로 생성
    const existing = document.getElementById("splash");
    if (existing) existing.remove();
    const div = document.createElement("div");
    div.id = "splash";
    div.setAttribute("aria-hidden", "true");
    div.textContent = "kiyo";
    document.body.appendChild(div);
  });

  it("① 기본 렌더: role='status' + aria-live='polite' + aria-label='앱 초기화 중'", () => {
    render(<SplashScreen />);
    const status = screen.getByRole("status", { name: "앱 초기화 중" });
    expect(status).toBeInTheDocument();
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("② Spinner 렌더 (aria-hidden으로 장식용)", () => {
    const { container } = render(<SplashScreen />);
    const spinner = container.querySelector("[data-testid='spinner']");
    expect(spinner).not.toBeNull();
  });

  it("③ mount 시 index.html의 inline #splash DOM 정리", () => {
    expect(document.getElementById("splash")).not.toBeNull();
    render(<SplashScreen />);
    expect(document.getElementById("splash")).toBeNull();
  });

  it("④ #splash DOM이 없을 때도 에러 없이 mount", () => {
    document.getElementById("splash")?.remove();
    expect(() => render(<SplashScreen />)).not.toThrow();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});