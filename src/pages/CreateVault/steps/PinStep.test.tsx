import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PinStep } from "./PinStep";

describe("PinStep component", () => {
  const defaultProps = {
    fileName: "test-vault",
    pin: "",
    onPinChange: vi.fn(),
    onBack: vi.fn(),
    onSubmit: vi.fn(),
    onSkip: vi.fn(),
    isSubmitting: false,
    error: null as string | null,
  };

  it("파일명 표시 (D3-a)", () => {
    render(<PinStep {...defaultProps} />);
    expect(screen.getByTestId("create-vault-target-name")).toHaveTextContent(
      "test-vault.json",
    );
  });

  it("PIN 4자 이상이면 생성 버튼 활성화", () => {
    render(<PinStep {...defaultProps} pin="1234" />);
    expect(screen.getByTestId("create-vault-submit")).toBeEnabled();
  });

  it("PIN 3자면 생성 버튼 disabled", () => {
    render(<PinStep {...defaultProps} pin="123" />);
    expect(screen.getByTestId("create-vault-submit")).toBeDisabled();
  });

  it("PIN 0자면 생성 버튼 disabled", () => {
    render(<PinStep {...defaultProps} pin="" />);
    expect(screen.getByTestId("create-vault-submit")).toBeDisabled();
  });

  it("isSubmitting이면 생성 버튼 disabled", () => {
    render(<PinStep {...defaultProps} pin="1234" isSubmitting={true} />);
    expect(screen.getByTestId("create-vault-submit")).toBeDisabled();
  });

  it("isSubmitting이면 이전 버튼도 disabled", () => {
    render(<PinStep {...defaultProps} pin="1234" isSubmitting={true} />);
    expect(screen.getByTestId("create-vault-back")).toBeDisabled();
  });

  it("에러 있을 때 인라인 에러 표시 (Q14-1)", () => {
    render(<PinStep {...defaultProps} error="PIN 정책 위반" />);
    expect(screen.getByTestId("create-vault-pin-error")).toHaveTextContent(
      "PIN 정책 위반",
    );
  });

  it("에러 없을 때 인라인 에러 미렌더", () => {
    render(<PinStep {...defaultProps} error={null} />);
    expect(
      screen.queryByTestId("create-vault-pin-error"),
    ).not.toBeInTheDocument();
  });

  it("이전 버튼 onBack 호출", () => {
    const onBack = vi.fn();
    render(<PinStep {...defaultProps} onBack={onBack} />);
    screen.getByTestId("create-vault-back").click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("생성 버튼 onSubmit 호출 (PIN 유효 시)", () => {
    const onSubmit = vi.fn();
    render(<PinStep {...defaultProps} pin="1234" onSubmit={onSubmit} />);
    screen.getByTestId("create-vault-submit").click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("비밀번호 없이 만들기 버튼: onSkip 호출", () => {
    const onSkip = vi.fn();
    render(<PinStep {...defaultProps} onSkip={onSkip} />);
    screen.getByTestId("create-vault-skip-pin").click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("isSubmitting이면 건너뛰기 버튼도 disabled", () => {
    render(<PinStep {...defaultProps} isSubmitting={true} />);
    expect(screen.getByTestId("create-vault-skip-pin")).toBeDisabled();
  });
});
