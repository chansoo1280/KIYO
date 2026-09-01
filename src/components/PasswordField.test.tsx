import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordField } from "./PasswordField";

describe("PasswordField (Plan-G4)", () => {
  it("① mode='view' 렌더 (값 표시 + Eye + 복사)", () => {
    render(<PasswordField mode="view" value="secret123" />);
    // 초기 가려진 상태 → "••••••••"
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    // 복사 버튼 존재
    expect(screen.getByRole("button", { name: "복사" })).toBeInTheDocument();
  });

  it("② mode='edit' 렌더 (input + Eye + onGenerate 있으면 생성 버튼)", () => {
    render(
      <PasswordField
        mode="edit"
        value="secret"
        onChange={() => {}}
        onGenerate={() => {}}
      />,
    );
    const input = document.querySelector('input[type="password"]');
    expect(input).not.toBeNull();
    expect(screen.getByRole("button", { name: "비밀번호 생성" })).toBeInTheDocument();
  });

  it("③ Eye 토글 — display state 변경 (view 모드)", () => {
    render(<PasswordField mode="view" value="mySecret" />);
    // 초기: 가려진 상태
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    // Eye 토글 클릭 → 값 표시
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 보이기" }));
    expect(screen.getByText("mySecret")).toBeInTheDocument();
    // 다시 클릭 → 가려짐
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 숨기기" }));
    expect(screen.getByText("••••••••")).toBeInTheDocument();
  });

  it("④ 복사 버튼 클릭 → onCopy 콜백 호출 (view 모드)", () => {
    const onCopy = vi.fn();
    render(<PasswordField mode="view" value="copyMe" onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    expect(onCopy).toHaveBeenCalledWith("copyMe");
  });

  it("⑤ mode='edit' + onGenerate 없을 때 — 생성 버튼 미렌더", () => {
    render(<PasswordField mode="edit" value="secret" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "비밀번호 생성" })).toBeNull();
  });
});