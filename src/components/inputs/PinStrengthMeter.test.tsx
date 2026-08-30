import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PinStrengthMeter from "@/components/inputs/PinStrengthMeter";

describe("PinStrengthMeter (Plan-4 §7.1)", () => {
  it("① pin=\"\" → 바 0% + '매우 약함' + 'PIN을 4자 이상 입력하세요'", () => {
    render(<PinStrengthMeter pin="" />);
    const label = screen.getByTestId("pin-strength-label");
    expect(label.textContent).toBe("매우 약함");
    const bar = screen.getByTestId("pin-strength-bar");
    expect(bar.getAttribute("data-score")).toBe("0");
    expect(bar.style.width).toBe("0%");
    const hint = screen.getByTestId("pin-strength-hint");
    expect(hint.getAttribute("data-pin-hint")).toBe("min-length");
    expect(hint.textContent).toBe("PIN을 4자 이상 입력하세요");
  });

  it("①-bis pin=\"1\" → 바 10% + '매우 약함' + 안내 (1자리)", () => {
    render(<PinStrengthMeter pin="1" />);
    expect(screen.getByTestId("pin-strength-label").textContent).toBe("매우 약함");
    expect(screen.getByTestId("pin-strength-bar").style.width).toBe("10%");
    expect(screen.getByTestId("pin-strength-hint").textContent).toBe("PIN을 4자 이상 입력하세요");
  });

  it("①-ter pin=\"123\" → 바 10% + '매우 약함' + 안내 (MIN 직전)", () => {
    render(<PinStrengthMeter pin="123" />);
    expect(screen.getByTestId("pin-strength-label").textContent).toBe("매우 약함");
    expect(screen.getByTestId("pin-strength-bar").style.width).toBe("10%");
    expect(screen.getByTestId("pin-strength-hint").textContent).toBe("PIN을 4자 이상 입력하세요");
  });

  it("② pin=\"1234\" → 바 20% + '매우 약함' (강도 라벨만, 안내 없음)", () => {
    render(<PinStrengthMeter pin="1234" />);
    expect(screen.getByTestId("pin-strength-label").textContent).toBe("매우 약함");
    expect(screen.getByTestId("pin-strength-bar").style.width).toBe("20%");
    // 4자 이상 = 안내 사라짐
    expect(screen.queryByTestId("pin-strength-hint")).not.toBeInTheDocument();
  });

  it("③ score별 색상/너비 변경 (data-score 속성)", () => {
    const { rerender } = render(<PinStrengthMeter pin="1234" />);
    const bar = screen.getByTestId("pin-strength-bar");
    expect(bar.getAttribute("data-score")).toBe("0");
    expect(bar.style.width).toBe("20%"); // (0+1)/5 * 100

    // 영문+특수문자+숫자 9자 → score=3
    rerender(<PinStrengthMeter pin="Abc123!@#" />);
    const bar2 = screen.getByTestId("pin-strength-bar");
    expect(bar2.getAttribute("data-score")).toBe("3");
    expect(bar2.style.width).toBe("80%");
  });

  it("④ onChange 재호출 시 라벨 업데이트 (props 변경 감지)", () => {
    const { rerender } = render(<PinStrengthMeter pin="1234" />);
    expect(screen.getByTestId("pin-strength-label").textContent).toBe("매우 약함");

    // props 업데이트 시뮬레이션
    rerender(<PinStrengthMeter pin="MyVault2024!" />); // score=4
    expect(screen.getByTestId("pin-strength-label").textContent).toBe("매우 강함");
  });

  it("⑤ 12자 → 3자 줄어들면 '매우 강함' → '매우 약함' + 'PIN을 4자 이상 입력하세요' 안내 추가", () => {
    const { rerender } = render(<PinStrengthMeter pin="MyVault2024!" />);
    expect(screen.getByTestId("pin-strength-label").textContent).toBe("매우 강함");
    expect(screen.queryByTestId("pin-strength-hint")).not.toBeInTheDocument();

    rerender(<PinStrengthMeter pin="123" />);
    // 강도 라벨은 "매우 약함"으로 바뀌고, 안내가 추가됨
    expect(screen.getByTestId("pin-strength-label").textContent).toBe("매우 약함");
    expect(screen.getByTestId("pin-strength-hint").textContent).toBe("PIN을 4자 이상 입력하세요");
  });
});