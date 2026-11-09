import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "./Input";

describe("Input (Plan-F1)", () => {
  // size (3)
  it("① size='sm' 렌더: py-1.5 text-sm", () => {
    render(<Input size="sm" placeholder="x" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toContain("py-1.5");
    expect(el.className).toContain("text-sm");
  });

  it("② size='md' (default) 렌더: py-2 text-sm", () => {
    render(<Input placeholder="x" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toContain("py-2");
  });

  it("③ size='lg' 렌더: py-3 text-base", () => {
    render(<Input size="lg" placeholder="x" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toContain("py-3");
    expect(el.className).toContain("text-base");
  });

  // variant (4)
  it("④ default variant (no extra class)", () => {
    render(<Input placeholder="x" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toContain("bg-[var(--color-bg)]");
    expect(el.getAttribute("aria-invalid")).toBeNull();
    expect(el.getAttribute("aria-readonly")).toBeNull();
    expect(el.getAttribute("aria-disabled")).toBeNull();
  });

  it("⑤ readonly variant → aria-readonly + bg-code-bg + cursor-default", () => {
    render(<Input variant="readonly" value="hi" readOnly placeholder="x" />);
    const el = screen.getByDisplayValue("hi");
    expect(el.getAttribute("aria-readonly")).toBe("true");
    expect(el.className).toContain("bg-[var(--color-code-bg)]");
    expect(el.className).toContain("cursor-default");
  });

  it("⑥ error variant → aria-invalid + aria-describedby 연결", () => {
    render(
      <>
        <Input variant="error" errorId="my-err" placeholder="x" />
        <p id="my-err">오류 메시지</p>
      </>,
    );
    const el = screen.getByPlaceholderText("x");
    expect(el.getAttribute("aria-invalid")).toBe("true");
    expect(el.getAttribute("aria-describedby")).toBe("my-err");
  });

  it("⑦ disabled variant → aria-disabled + disabled + opacity-50 + cursor-not-allowed", () => {
    render(<Input variant="disabled" placeholder="x" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.getAttribute("aria-disabled")).toBe("true");
    expect((el as HTMLInputElement).disabled).toBe(true);
    expect(el.className).toContain("opacity-50");
    expect(el.className).toContain("cursor-not-allowed");
  });

  // as (3)
  it('⑧ as="input" → <input> 렌더', () => {
    render(<Input placeholder="x" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.tagName).toBe("INPUT");
  });

  it('⑨ as="select" → <select> 렌더', () => {
    render(
      <Input as="select" aria-label="옵션">
        <option value="a">A</option>
      </Input>,
    );
    const el = screen.getByLabelText("옵션");
    expect(el.tagName).toBe("SELECT");
  });

  it('⑩ as="textarea" → <textarea> 렌더', () => {
    render(<Input as="textarea" aria-label="메모" />);
    const el = screen.getByLabelText("메모");
    expect(el.tagName).toBe("TEXTAREA");
  });

  // focus 스타일 (1)
  it("⑪ focus ring/border 자동 적용 (B1 변형)", () => {
    render(<Input placeholder="x" />);
    const el = screen.getByPlaceholderText("x");
    expect(el.className).toContain("focus:ring-2");
    expect(el.className).toContain("focus:ring-[var(--color-accent)]/20");
    expect(el.className).toContain("focus:border-[var(--color-accent)]");
  });

  // a11y (4)
  it("⑫ label prop이 있으면 <label htmlFor={id}> 렌더 + 연결", () => {
    render(<Input label="이메일" id="email-input" placeholder="x" />);
    const label = screen.getByText("이메일");
    expect(label.tagName).toBe("LABEL");
    expect(label.getAttribute("for")).toBe("email-input");
    const el = screen.getByLabelText("이메일");
    expect(el.getAttribute("id")).toBe("email-input");
  });

  it("⑬ helperText prop이 있으면 <p> 렌더", () => {
    render(<Input placeholder="x" helperText="도움말" />);
    expect(screen.getByText("도움말").tagName).toBe("P");
  });

  it("⑭ errorId가 aria-describedby로 연결 (variant 없이도)", () => {
    render(
      <>
        <Input errorId="my-err" placeholder="x" />
        <p id="my-err">msg</p>
      </>,
    );
    // variant="error" 없이 errorId만 있으면 aria-invalid는 안 붙고 aria-describedby는 안 붙음
    const el = screen.getByPlaceholderText("x");
    expect(el.getAttribute("aria-invalid")).toBeNull();
  });

  it("⑮ placeholder/type 등 표준 HTML attribute 전달", () => {
    render(<Input type="email" placeholder="이메일 입력" autoComplete="email" />);
    const el = screen.getByPlaceholderText("이메일 입력");
    expect(el.getAttribute("type")).toBe("email");
    expect(el.getAttribute("autocomplete")).toBe("email");
  });

  // 회귀 방지 (3)
  it("⑯ onChange 핸들러 호출", () => {
    const onChange = vi.fn();
    render(<Input placeholder="x" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("x"), { target: { value: "y" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("⑰ rounded-lg 일관 적용 (Plan-F1 Q4)", () => {
    render(<Input placeholder="x" />);
    expect(screen.getByPlaceholderText("x").className).toContain("rounded-lg");
  });

  it("⑱ var(--color-*) 디자인 토큰 일관 사용", () => {
    render(<Input placeholder="x" />);
    const cls = screen.getByPlaceholderText("x").className;
    expect(cls).toContain("var(--color-bg)");
    expect(cls).toContain("var(--color-text-h)");
    expect(cls).toContain("var(--color-border)");
  });

  // discriminated union (Finding1) - 단순 union으로 재결정 (호출처 25곳 `as` 명시 부담 ↓)
  it("⑲ props.id 누락 시 label prop 있어도 <label for>는 undefined (작업자 주의용)", () => {
    // typecheck에서는 잡히지 않는 케이스 — 작업자가 id prop 누락하면 a11y 연결 깨짐
    render(<Input label="제목" placeholder="x" />);
    const label = screen.getByText("제목");
    expect(label.getAttribute("for")).toBeNull();
  });
});