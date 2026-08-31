import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorScreen } from "@/components/ErrorScreen";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockNavigate.mockClear();
});

describe("ErrorScreen (Plan-D PR 1)", () => {
  it("① variant='generic' 렌더 + role='alert' + aria-live='assertive'", () => {
    render(<ErrorScreen variant="generic" error={new Error("boom")} />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(screen.getByText("데이터를 불러올 수 없습니다")).toBeInTheDocument();
  });

  it("② variant='generic': '홈으로' 버튼 클릭 시 /home으로 navigate (replace)", () => {
    render(<ErrorScreen variant="generic" error={new Error("boom")} />);
    const button = screen.getByRole("button", { name: "홈으로" });
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
  });

  it("③ variant='generic': Error 인스턴스가 아닐 때 '알 수 없는 오류' 표시", () => {
    render(<ErrorScreen variant="generic" error="string error" />);
    expect(screen.getByText("알 수 없는 오류")).toBeInTheDocument();
  });

  it("④ variant='stale' 렌더 + 누락된 파일명 표시", () => {
    render(<ErrorScreen variant="stale" missingFileName="my-vault.json" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("활성 파일을 찾을 수 없습니다")).toBeInTheDocument();
    expect(screen.getByText("my-vault.json")).toBeInTheDocument();
  });

  it("⑤ variant='stale': '홈으로' 버튼 클릭 시 /home으로 navigate (replace)", () => {
    render(<ErrorScreen variant="stale" missingFileName="missing.json" />);
    const button = screen.getByRole("button", { name: "홈으로" });
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
  });

  it("⑥ Button은 label prop 필수 (Plan-B-3 API 준수, F-1)", () => {
    // TypeScript 컴파일 시점에 검증됨 — 런타임 단언은 button text가 label prop으로 렌더링되는지 확인
    render(<ErrorScreen variant="generic" />);
    const button = screen.getByRole("button", { name: "홈으로" });
    expect(button).toBeInTheDocument();
  });
});