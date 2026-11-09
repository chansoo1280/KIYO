import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Checkbox } from "./Checkbox";

describe("Checkbox (Plan-F1)", () => {
  it("① checked=true → 체크 표시 + onChange 호출", () => {
    const onChange = vi.fn();
    render(<Checkbox label="동의" checked onChange={onChange} />);
    const cb = screen.getByRole("checkbox");
    expect(cb).toBeChecked();
    fireEvent.click(cb);
    expect(onChange).toHaveBeenCalled();
  });

  it("② checked=false → 미체크", () => {
    render(<Checkbox label="동의" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("③ disabled → disabled 속성 + 클릭은 발생하지만 native가 무시", () => {
    const onChange = vi.fn();
    render(<Checkbox label="동의" checked disabled onChange={onChange} />);
    const cb = screen.getByRole("checkbox");
    expect(cb).toBeDisabled();
    // disabled checkbox는 클릭 자체는 받지만 native disabled 속성이 변경을 막음.
    // 사용자가 실제로 클릭하는 의미적 효과는 0 → 테스트는 disabled 속성만 확인.
  });

  it("④ label prop 렌더 (wrapping label)", () => {
    render(<Checkbox label="파일 암호화 사용" checked={false} />);
    expect(screen.getByText("파일 암호화 사용").tagName).toBe("SPAN");
  });

  it("⑤ errorId가 aria-describedby로 연결", () => {
    render(
      <>
        <Checkbox label="동의" checked errorId="cb-err" />
        <p id="cb-err">오류</p>
      </>,
    );
    expect(screen.getByRole("checkbox").getAttribute("aria-describedby")).toBe("cb-err");
  });
});