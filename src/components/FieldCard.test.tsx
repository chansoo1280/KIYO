import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldCard } from "./FieldCard";

describe("FieldCard (Plan-G5)", () => {
  it("① label + children 렌더 (AccountDetail 패턴)", () => {
    render(
      <FieldCard label="사용자 이름">
        <span data-testid="value">홍길동</span>
      </FieldCard>,
    );
    expect(screen.getByText("사용자 이름")).toBeInTheDocument();
    expect(screen.getByTestId("value")).toBeInTheDocument();
  });

  it("② label 미지정 시 본문만 렌더 (TemplateFieldEditor 패턴)", () => {
    render(
      <FieldCard>
        <span data-testid="editor-content">editor content</span>
      </FieldCard>,
    );
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  it("③ density='compact' (default) → px-4 py-3", () => {
    const { container } = render(<FieldCard label="x">y</FieldCard>);
    const card = container.querySelector("div.rounded-2xl");
    expect(card?.className).toContain("px-4");
    expect(card?.className).toContain("py-3");
  });

  it("④ density='comfy' → p-4", () => {
    const { container } = render(
      <FieldCard density="comfy">y</FieldCard>,
    );
    const card = container.querySelector("div.rounded-2xl");
    expect(card?.className).toContain("p-4");
    expect(card?.className).not.toContain("px-4");
    expect(card?.className).not.toContain("py-3");
  });

  it("⑤ label className 보존 (tracking-label 토큰 정확)", () => {
    const { container } = render(<FieldCard label="x">y</FieldCard>);
    const labelP = container.querySelector("p");
    expect(labelP?.className).toContain("tracking-label");
    expect(labelP?.className).toContain("uppercase");
  });
});