import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stepper } from "./Stepper";

describe("Stepper component", () => {
  it("step=1: 첫 번째 단계 aria-current='step', 두 번째는 미설정", () => {
    render(<Stepper step={1} />);
    const stepper = screen.getByTestId("create-vault-stepper");
    expect(stepper).toHaveAttribute("aria-label", "파일 생성 단계");

    // 1. 이름 (current)
    const nameLi = stepper.querySelector('[data-state="current"]');
    expect(nameLi).toHaveTextContent("이름");
    expect(nameLi).toHaveAttribute("aria-current", "step");

    // 2. PIN (pending)
    const pinLi = stepper.querySelector('[data-state="pending"]');
    expect(pinLi).toHaveTextContent("PIN");
    expect(pinLi).not.toHaveAttribute("aria-current");
  });

  it("step=2: 첫 번째는 done, 두 번째가 current", () => {
    render(<Stepper step={2} />);
    const stepper = screen.getByTestId("create-vault-stepper");

    // 1. 이름 (done)
    const nameLi = stepper.querySelector('[data-state="done"]');
    expect(nameLi).toHaveTextContent("이름");
    expect(nameLi).not.toHaveAttribute("aria-current");

    // 2. PIN (current)
    const pinLi = stepper.querySelector('[data-state="current"]');
    expect(pinLi).toHaveTextContent("PIN");
    expect(pinLi).toHaveAttribute("aria-current", "step");
  });

  it("두 단계 라벨이 모두 렌더", () => {
    render(<Stepper step={1} />);
    expect(screen.getByText("이름")).toBeInTheDocument();
    expect(screen.getByText("PIN")).toBeInTheDocument();
  });
});
