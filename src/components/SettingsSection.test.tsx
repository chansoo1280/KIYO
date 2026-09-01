import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsSection } from "./SettingsSection";

describe("SettingsSection (Plan-G1)", () => {
  it("① <h2> 렌더 (Q6 위계 정정 회귀 가드)", () => {
    render(<SettingsSection title="Security">x</SettingsSection>);
    // h3가 아닌 h2를 사용해야 TemplateEdit 패턴과 일관
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Security");
  });

  it("② title prop → <h2> 텍스트 렌더", () => {
    render(<SettingsSection title="Autofill">x</SettingsSection>);
    expect(screen.getByText("Autofill")).toBeInTheDocument();
  });

  it("③ children 렌더", () => {
    render(
      <SettingsSection title="Security">
        <div data-testid="child-row">child content</div>
      </SettingsSection>,
    );
    expect(screen.getByTestId("child-row")).toHaveTextContent("child content");
  });

  it("④ 헤더 className 보존 (uppercase tracking-section)", () => {
    render(<SettingsSection title="UI">x</SettingsSection>);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.className).toContain("uppercase");
    expect(heading.className).toContain("tracking-section");
    expect(heading.className).toContain("text-[var(--color-text)]");
  });

  it("⑤ space-y-3 내부 컨테이너 렌더 (row 간격)", () => {
    const { container } = render(
      <SettingsSection title="Data">
        <div>r1</div>
        <div>r2</div>
      </SettingsSection>,
    );
    // <div className="space-y-3">가 h2와 형제로 존재
    const innerContainer = container.querySelector("div > div.space-y-3");
    expect(innerContainer).not.toBeNull();
    expect(innerContainer?.children.length).toBe(2);
  });
});