import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BaseDialog from "@/components/dialogs/BaseDialog";

describe("BaseDialog - Component Tests", () => {
  it("open=false일 때 아무것도 렌더링하지 않음", () => {
    render(<BaseDialog open={false} title="Test" onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true일 때 다이얼로그 렌더링", () => {
    render(<BaseDialog open={true} title="Test Title" onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("description이 있으면 표시됨", () => {
    render(<BaseDialog open={true} title="Test" description="설명입니다" onClose={vi.fn()} />);
    expect(screen.getByText("설명입니다")).toBeInTheDocument();
  });

  it("children이 있으면 렌더링됨", () => {
    render(
      <BaseDialog open={true} title="Test" onClose={vi.fn()}>
        <div data-testid="custom-content">Custom Content</div>
      </BaseDialog>
    );
    expect(screen.getByTestId("custom-content")).toBeInTheDocument();
  });

  it("닫기 버튼 클릭 시 onClose 호출", () => {
    const onClose = vi.fn();
    render(<BaseDialog open={true} title="Test" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("오버레이 클릭 시 onClose 호출", () => {
    const onClose = vi.fn();
    render(<BaseDialog open={true} title="Test" onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("내부 컨텐츠 클릭 시 onClose 호출 안 됨 (stopPropagation)", () => {
    const onClose = vi.fn();
    render(
      <BaseDialog open={true} title="Test" onClose={onClose}>
        <button data-testid="inner-btn">Inner</button>
      </BaseDialog>
    );
    fireEvent.click(screen.getByTestId("inner-btn"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("showCloseButton=false일 때 닫기 버튼 없음", () => {
    render(<BaseDialog open={true} title="Test" onClose={vi.fn()} showCloseButton={false} />);
    expect(screen.queryByLabelText("닫기")).not.toBeInTheDocument();
  });

  it("className이 적용됨", () => {
    const { container } = render(<BaseDialog open={true} title="Test" onClose={vi.fn()} className="custom-class" />);
    const dialogContent = container.querySelector(".custom-class");
    expect(dialogContent).toBeInTheDocument();
  });

  it("올바른 ARIA 속성 있음", () => {
    render(<BaseDialog open={true} title="Test" onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});