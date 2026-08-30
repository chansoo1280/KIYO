import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Button from "./Button";

describe("Button (Plan-B-1)", () => {
  it("① 기본 렌더: label 표시 + data-testid='button'", () => {
    render(<Button label="저장" />);
    const btn = screen.getByTestId("button");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("저장");
  });

  it("② type prop 기본값 'button' (submit 폼 안에서 자동 submit 안 함)", () => {
    render(<Button label="Cancel" />);
    const btn = screen.getByTestId("button");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("③ type='submit' 명시 가능", () => {
    render(<Button label="Save" type="submit" />);
    const btn = screen.getByTestId("button");
    expect(btn.getAttribute("type")).toBe("submit");
  });

  it("④ loading=true → Spinner 렌더 + aria-busy='true' + disabled", () => {
    render(<Button label="저장 중" loading />);
    const btn = screen.getByTestId("button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.getAttribute("data-loading")).toBe("true");
    // Spinner (aria-hidden=true로 button name에 영향 없음)
    const spinner = btn.querySelector("[data-testid='spinner']");
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute("aria-hidden")).toBe("true");
  });

  it("⑤ loading=false → aria-busy 미설정", () => {
    render(<Button label="저장" />);
    const btn = screen.getByTestId("button");
    expect(btn.getAttribute("aria-busy")).toBeNull();
  });

  it("⑥ disabled=true → disabled 속성", () => {
    render(<Button label="비활성" disabled />);
    const btn = screen.getByTestId("button");
    expect(btn).toBeDisabled();
  });

  it("⑦ variant='primary' → accent bg 클래스", () => {
    render(<Button label="primary" variant="primary" />);
    const btn = screen.getByTestId("button");
    expect(btn.className).toContain("bg-[var(--color-accent)]");
  });

  it("⑧ variant='danger' → error bg 클래스", () => {
    render(<Button label="삭제" variant="danger" />);
    const btn = screen.getByTestId("button");
    expect(btn.className).toContain("bg-[var(--color-error)]");
  });

  it("⑨ onClick 핸들러 호출", () => {
    const onClick = vi.fn();
    render(<Button label="클릭" onClick={onClick} />);
    fireEvent.click(screen.getByTestId("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("⑩ loading=true일 때 onClick 호출 안 됨 (disabled)", () => {
    const onClick = vi.fn();
    render(<Button label="로딩" loading onClick={onClick} />);
    fireEvent.click(screen.getByTestId("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
