import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

const defaultProps = {
  open: true,
  title: "테스트",
  message: "정말 진행하시겠습니까?",
  onClose: vi.fn(),
  onConfirm: vi.fn(),
};

describe("ConfirmDialog (Plan-A1)", () => {
  it("① open=false → 렌더 안 함", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("② open=true → title + message 표시", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("테스트")).toBeInTheDocument();
    expect(screen.getByText("정말 진행하시겠습니까?")).toBeInTheDocument();
  });

  it("③ error=null → 에러 영역 없음", () => {
    render(<ConfirmDialog {...defaultProps} error={null} />);
    expect(screen.queryByTestId("confirm-dialog-error")).not.toBeInTheDocument();
  });

  it("④ error=메시지 → 인라인 에러 영역 + role=alert", () => {
    render(<ConfirmDialog {...defaultProps} error="PIN 번호가 올바르지 않습니다." />);
    const errorEl = screen.getByTestId("confirm-dialog-error");
    expect(errorEl).toBeInTheDocument();
    expect(errorEl.getAttribute("role")).toBe("alert");
    expect(errorEl).toHaveTextContent("PIN 번호가 올바르지 않습니다.");
  });

  it("⑤ 취소 클릭 → onClose 호출", () => {
    const onClose = vi.fn();
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("⑥ 확인 클릭 → onConfirm 호출", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("⑦ isLoading=true → 확인 버튼 disabled + '처리 중...'", () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} confirmLabel="저장" />);
    const confirmBtn = screen.getByRole("button", { name: "처리 중..." });
    expect(confirmBtn).toBeDisabled();
  });
});
