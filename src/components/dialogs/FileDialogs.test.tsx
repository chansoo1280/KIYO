import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FileOpenDialog from "@/components/dialogs/FileOpenDialog";
import FileCreateDialog from "@/components/dialogs/FileCreateDialog";

describe("FileOpenDialog - Component Tests", () => {
  it("open=false일 때 아무것도 렌더링하지 않음", () => {
    render(<FileOpenDialog open={false} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true일 때 다이얼로그 렌더링", () => {
    render(<FileOpenDialog open={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("파일 열기")).toBeInTheDocument();
  });

  it("파일 선택 버튼이 표시됨", () => {
    render(<FileOpenDialog open={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("파일 선택")).toBeInTheDocument();
  });

  it("확인 버튼 비활성화: 파일 선택 안 함", () => {
    render(<FileOpenDialog open={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "열기" })).toBeDisabled();
  });

  it("취소 버튼이 있음", () => {
    render(<FileOpenDialog open={true} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("닫기 버튼 클릭 시 onClose 호출", () => {
    const onClose = vi.fn();
    render(<FileOpenDialog open={true} onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("FileCreateDialog - Component Tests", () => {
  it("open=false일 때 아무것도 렌더링하지 않음", () => {
    render(
      <FileCreateDialog
        open={false}
        title="파일 생성"
        description="설명"
        defaultValue="new.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true일 때 다이얼로그 렌더링", () => {
    render(
      <FileCreateDialog
        open={true}
        title="파일 생성"
        description="파일 생성 설명"
        defaultValue="new.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("파일 생성")).toBeInTheDocument();
    expect(screen.getByText("파일 생성 설명")).toBeInTheDocument();
  });

  it("기본 파일명 표시 (확장자 제외)", () => {
    render(
      <FileCreateDialog
        open={true}
        title="파일 생성"
        description="설명"
        defaultValue="myvault.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("myvault")).toBeInTheDocument();
  });

  it("파일명 입력 시 상태 업데이트", () => {
    render(
      <FileCreateDialog
        open={true}
        title="파일 생성"
        description="설명"
        defaultValue="new.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const input = screen.getByDisplayValue("new");
    fireEvent.change(input, { target: { value: "custom" } });
    expect(screen.getByDisplayValue("custom")).toBeInTheDocument();
  });

  it("암호화 체크박스 기본 체크됨", () => {
    render(
      <FileCreateDialog
        open={true}
        title="파일 생성"
        description="설명"
        defaultValue="new.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("checkbox", { name: "파일 암호화 사용" })).toBeChecked();
  });

  it("암호화 체크 해제/체크 토글 동작", () => {
    render(
      <FileCreateDialog
        open={true}
        title="파일 생성"
        description="설명"
        defaultValue="new.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    
    const checkbox = screen.getByRole("checkbox", { name: "파일 암호화 사용" });
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("체크박스 토글 시 파일명 값이 유지되어야 함", () => {
    render(
      <FileCreateDialog
        open={true}
        title="파일 생성"
        description="설명"
        defaultValue="new.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    
    // 파일명 입력
    const fileNameInput = screen.getByDisplayValue("new");
    fireEvent.change(fileNameInput, { target: { value: "my-custom-vault" } });
    expect(screen.getByDisplayValue("my-custom-vault")).toBeInTheDocument();
    
    // 암호화 체크박스 해제
    const checkbox = screen.getByRole("checkbox", { name: "파일 암호화 사용" });
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    
    // 파일명이 유지되어야 함
    expect(screen.getByDisplayValue("my-custom-vault")).toBeInTheDocument();
    
    // 다시 체크
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    
    // 파일명이 여전히 유지되어야 함
    expect(screen.getByDisplayValue("my-custom-vault")).toBeInTheDocument();
  });

  it("취소/닫기 버튼이 있음", () => {
    render(
      <FileCreateDialog
        open={true}
        title="파일 생성"
        description="설명"
        defaultValue="new.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByLabelText("닫기")).toBeInTheDocument();
  });

  it("닫기 버튼 클릭 시 onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <FileCreateDialog
        open={true}
        title="파일 생성"
        description="설명"
        defaultValue="new.json"
        confirmLabel="생성"
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});