import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner } from "@/components/feedback/Spinner";

describe("Spinner (Plan-A2)", () => {
  it("① 기본 렌더: data-testid='spinner' + role='status' + 기본 label='로딩 중'", () => {
    render(<Spinner />);
    const spinner = screen.getByTestId("spinner");
    expect(spinner).toBeInTheDocument();
    expect(spinner.getAttribute("role")).toBe("status");
    expect(spinner.getAttribute("aria-label")).toBe("로딩 중");
  });

  it("② size='sm' → h-4 w-4 클래스 적용", () => {
    render(<Spinner size="sm" />);
    const spinner = screen.getByTestId("spinner");
    expect(spinner.className).toContain("h-4");
    expect(spinner.className).toContain("w-4");
  });

  it("③ size='md' (기본값) → h-6 w-6 클래스 적용", () => {
    render(<Spinner />);
    const spinner = screen.getByTestId("spinner");
    expect(spinner.className).toContain("h-6");
    expect(spinner.className).toContain("w-6");
  });

  it("④ size='lg' → h-8 w-8 클래스 적용", () => {
    render(<Spinner size="lg" />);
    const spinner = screen.getByTestId("spinner");
    expect(spinner.className).toContain("h-8");
    expect(spinner.className).toContain("w-8");
  });

  it("⑤ label prop → aria-label로 노출", () => {
    render(<Spinner label="계정을 불러오는 중..." />);
    const spinner = screen.getByTestId("spinner");
    expect(spinner.getAttribute("aria-label")).toBe("계정을 불러오는 중...");
  });

  it("⑥ SVG는 aria-hidden='true' (장식 요소)", () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("⑦ className prop 추가 시 base 클래스와 합쳐짐", () => {
    render(<Spinner className="text-[var(--color-accent)]" />);
    const spinner = screen.getByTestId("spinner");
    expect(spinner.className).toContain("text-[var(--color-accent)]");
    expect(spinner.className).toContain("inline-block");
  });

  it("⑧ aria-hidden=true → role='status' 미부여 + label 미적용 (장식용)", () => {
    render(<Spinner aria-hidden />);
    const spinner = screen.getByTestId("spinner");
    expect(spinner.getAttribute("aria-hidden")).toBe("true");
    expect(spinner.getAttribute("role")).toBeNull();
    expect(spinner.getAttribute("aria-label")).toBeNull();
  });
});
