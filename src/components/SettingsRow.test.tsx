import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsRow } from "./SettingsRow";

describe("SettingsRow (Plan-G1)", () => {
  it("① <div> row 컨테이너 렌더 (인라인 className 흡수 확인)", () => {
    const { container } = render(
      <SettingsRow label="PIN">
        <button>x</button>
      </SettingsRow>,
    );
    const row = container.querySelector("div.flex.items-center");
    expect(row).not.toBeNull();
    expect(row?.className).toContain("rounded-2xl");
    expect(row?.className).toContain("border-[var(--color-border)]");
    expect(row?.className).toContain("bg-[var(--color-bg)]");
    expect(row?.className).toContain("px-4");
    expect(row?.className).toContain("py-4");
  });

  it("② label string → text 렌더", () => {
    render(<SettingsRow label="PIN">x</SettingsRow>);
    expect(screen.getByText("PIN")).toBeInTheDocument();
  });

  it("③ label ReactNode → 보조 텍스트 패턴 흡수 (AutofillSection 패턴)", () => {
    render(
      <SettingsRow
        label={
          <>
            <span className="font-medium">자동완성 사용</span>
            <span className="text-xs">앱에서 자동완성 기능 사용 여부</span>
          </>
        }
      >
        <button>x</button>
      </SettingsRow>,
    );
    expect(screen.getByText("자동완성 사용")).toBeInTheDocument();
    expect(screen.getByText("앱에서 자동완성 기능 사용 여부")).toBeInTheDocument();
  });

  it("④ children 컨테이너 위치 (라벨 우측)", () => {
    render(
      <SettingsRow label="PIN">
        <button data-testid="control">변경</button>
      </SettingsRow>,
    );
    const control = screen.getByTestId("control");
    // children은 row div의 마지막 자식이어야 함 (라벨 <div> 다음)
    const row = control.closest("div.flex.items-center");
    expect(row).not.toBeNull();
    // row의 마지막 자식이 control이어야 함
    expect(row?.lastElementChild).toBe(control);
    // 라벨은 <div>로 감싸져서 첫 자식
    expect(row?.firstElementChild?.textContent).toContain("PIN");
  });

  it("⑤ row className 보존 — rounded-2xl border + bg-var(--color-bg)", () => {
    const { container } = render(
      <SettingsRow label="자동잠금">x</SettingsRow>,
    );
    const row = container.querySelector("div.flex");
    expect(row?.className).toContain("rounded-2xl");
    expect(row?.className).toContain("border");
    expect(row?.className).toContain("bg-[var(--color-bg)]");
    expect(row?.className).toContain("text-[var(--color-text)]");
  });
});