import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordFieldEdit } from "@/pages/Accounts/AccountEdit/components/PasswordFieldEdit";

describe("PasswordFieldEdit - Component Tests", () => {
  it("value가 입력 필드에 표시됨", () => {
    render(<PasswordFieldEdit value="secret123" onChange={vi.fn()} />);
    const input = screen.getByDisplayValue("secret123");
    expect(input).toHaveValue("secret123");
  });

  it("입력 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<PasswordFieldEdit value="secret" onChange={onChange} />);
    const input = screen.getByDisplayValue("secret");
    fireEvent.change(input, { target: { value: "secret123" } });
    expect(onChange).toHaveBeenCalledWith("secret123");
  });

  it("기본적으로 비밀번호 타입으로 마스킹됨", () => {
    render(<PasswordFieldEdit value="secret" onChange={vi.fn()} />);
    const input = screen.getByDisplayValue("secret");
    expect(input).toHaveAttribute("type", "password");
  });

  it("eye 버튼 클릭 시 비밀번호 보이기/숨기기 토글", () => {
    render(<PasswordFieldEdit value="secret" onChange={vi.fn()} />);
    
    // 기본: password 타입
    const input = screen.getByDisplayValue("secret");
    expect(input).toHaveAttribute("type", "password");
    
    // eye 버튼 클릭
    fireEvent.click(screen.getByLabelText("비밀번호 보이기"));
    expect(input).toHaveAttribute("type", "text");
    
    // 다시 클릭
    fireEvent.click(screen.getByLabelText("비밀번호 숨기기"));
    expect(input).toHaveAttribute("type", "password");
  });

  it("onGenerate prop이 있을 때 생성 버튼 표시", () => {
    render(<PasswordFieldEdit value="" onChange={vi.fn()} onGenerate={vi.fn()} />);
    expect(screen.getByLabelText("비밀번호 생성")).toBeInTheDocument();
  });

  it("onGenerate prop이 없으면 생성 버튼 없음", () => {
    render(<PasswordFieldEdit value="" onChange={vi.fn()} />);
    expect(screen.queryByLabelText("비밀번호 생성")).not.toBeInTheDocument();
  });

  it("생성 버튼 클릭 시 onGenerate 호출", () => {
    const onGenerate = vi.fn();
    render(<PasswordFieldEdit value="" onChange={vi.fn()} onGenerate={onGenerate} />);
    fireEvent.click(screen.getByLabelText("비밀번호 생성"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("aria-label이 토글 상태에 맞게 변경됨", () => {
    render(<PasswordFieldEdit value="secret" onChange={vi.fn()} />);
    
    const eyeButton = screen.getByLabelText("비밀번호 보이기");
    expect(eyeButton).toBeInTheDocument();
    
    fireEvent.click(eyeButton);
    expect(screen.getByLabelText("비밀번호 숨기기")).toBeInTheDocument();
  });
});