import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SyncErrorBanner } from "@/components/SyncErrorBanner";

// 동적 mock state — selector가 매번 최신 값을 읽도록 useState처럼 사용
let mockLastSyncError: string | null = null;
const mockClearSyncError = vi.fn();

vi.mock("@/store/sessionStore", () => ({
  useSessionStore: (selector: (state: { lastSyncError: string | null; clearSyncError: () => void }) => unknown) =>
    selector({
      get lastSyncError() {
        return mockLastSyncError;
      },
      clearSyncError: mockClearSyncError,
    }),
}));

describe("SyncErrorBanner (Plan-A1)", () => {
  beforeEach(() => {
    mockLastSyncError = null;
    mockClearSyncError.mockClear();
  });

  it("① lastSyncError=null → 렌더 안 함", () => {
    mockLastSyncError = null;
    const { container } = render(<SyncErrorBanner />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("sync-error-banner")).not.toBeInTheDocument();
  });

  it("② lastSyncError=메시지 → 배너 + role='alert' + 메시지 렌더", () => {
    mockLastSyncError = "자동 저장에 실패했습니다";
    render(<SyncErrorBanner />);
    const banner = screen.getByTestId("sync-error-banner");
    expect(banner).toBeInTheDocument();
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner).toHaveTextContent("자동 저장에 실패했습니다");
  });

  it("③ 닫기 버튼 클릭 → clearSyncError 호출", () => {
    mockLastSyncError = "동기화 실패";
    render(<SyncErrorBanner />);
    const closeButton = screen.getByTestId("sync-error-banner-close");
    expect(closeButton.getAttribute("aria-label")).toBe("에러 배너 닫기");
    fireEvent.click(closeButton);
    expect(mockClearSyncError).toHaveBeenCalledTimes(1);
  });

  it("④ 닫기 버튼은 visible 상태에서만 존재", () => {
    mockLastSyncError = null;
    render(<SyncErrorBanner />);
    expect(screen.queryByTestId("sync-error-banner-close")).not.toBeInTheDocument();
  });
});
