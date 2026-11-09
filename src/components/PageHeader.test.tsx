import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

describe("PageHeader (Plan-G2)", () => {
  it("① <header> + <h1> 렌더", () => {
    const { container } = render(<PageHeader title="Settings" />);
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
  });

  it("② title prop → <h1> 텍스트", () => {
    render(<PageHeader title="Settings" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings");
  });

  it("③ actions optional — 미전달 시 actions 영역 미렌더", () => {
    const { container } = render(<PageHeader title="Settings" />);
    // <header>에 <h1>만 있어야 함 (actions <div>는 optional 렌더 0)
    const header = container.querySelector("header");
    expect(header?.children.length).toBe(1);
  });

  it("④ actions ReactNode — 우측 슬롯 렌더", () => {
    render(
      <PageHeader
        title="템플릿 관리"
        actions={<button data-testid="action-btn">+ 템플릿 생성</button>}
      />,
    );
    const actionBtn = screen.getByTestId("action-btn");
    const header = actionBtn.closest("header");
    expect(header).not.toBeNull();
    // <h1> 다음 위치에 actions가 있어야 함 (header의 마지막 자식)
    expect(header?.lastElementChild).toBe(actionBtn);
  });

  it("⑤ header className 보존 — flex items-center justify-between gap-3", () => {
    const { container } = render(<PageHeader title="Settings" />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("flex");
    expect(header?.className).toContain("items-center");
    expect(header?.className).toContain("justify-between");
    expect(header?.className).toContain("gap-3");
  });
});