import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageShell } from "./PageShell";

describe("PageShell (Plan-G2)", () => {
  it("① <main> 렌더 (Q5 landmark 통일 회귀 가드)", () => {
    const { container } = render(<PageShell>x</PageShell>);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    // <section>이 아닌 <main>이어야 함
    expect(main?.tagName).toBe("MAIN");
  });

  it("② maxWidth='lg' → max-w-3xl className", () => {
    const { container } = render(<PageShell maxWidth="lg">x</PageShell>);
    const innerDiv = container.querySelector("div.max-w-3xl");
    expect(innerDiv).not.toBeNull();
  });

  it("③ maxWidth='xl' → max-w-4xl className", () => {
    const { container } = render(<PageShell maxWidth="xl">x</PageShell>);
    const innerDiv = container.querySelector("div.max-w-4xl");
    expect(innerDiv).not.toBeNull();
  });

  it("③-b maxWidth='sm' → max-w-md className", () => {
    const { container } = render(<PageShell maxWidth="sm">x</PageShell>);
    const innerDiv = container.querySelector("div.max-w-md");
    expect(innerDiv).not.toBeNull();
  });

  it("④ withBottomTabs → pb-28 className", () => {
    const { container } = render(<PageShell withBottomTabs>x</PageShell>);
    const main = container.querySelector("main");
    expect(main?.className).toContain("pb-28");
  });

  it("⑤ children 렌더", () => {
    render(
      <PageShell>
        <div data-testid="page-content">page content</div>
      </PageShell>,
    );
    expect(screen.getByTestId("page-content")).toHaveTextContent("page content");
  });
});