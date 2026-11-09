import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AccountEdit from "./index";

const mockAddAccount = vi.fn();
const mockUpdateAccount = vi.fn();

// CreateVaultPage.test.tsx 패턴 — 컴포넌트를 MemoryRouter 안에 직접 넣음
vi.mock("@/store/accountStore", () => ({
  useAccountStore: (selector: (state: unknown) => unknown) =>
    selector({
      accounts: [],
      addAccount: mockAddAccount,
      updateAccount: mockUpdateAccount,
    }),
}));

const mockTemplates: { id: string; name: string; fields: unknown[]; description: string; icon: string; sortOrder: number }[] = [];

vi.mock("@/store/templateStore", () => ({
  useTemplateStore: (selector: (state: unknown) => unknown) =>
    selector({
      templates: mockTemplates,
      loadTemplates: vi.fn(),
    }),
}));

vi.mock("@/hooks/useFileAuthGuard", () => ({
  useFileAuthGuard: () => undefined,
}));

const renderPage = (path: string = "/accounts/new") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AccountEdit />
    </MemoryRouter>,
  );

describe("AccountEdit (Plan-A1)", () => {
  beforeEach(() => {
    mockAddAccount.mockReset();
    mockUpdateAccount.mockReset();
  });

  it("① 신규 계정: 제목 + 저장 → addAccount 호출", async () => {
    mockAddAccount.mockResolvedValue({ id: 5 });
    const user = userEvent.setup();
    renderPage();

    const titleInput = screen.getByRole("textbox", { name: /제목|타이틀|title/i });
    await user.type(titleInput, "Test");

    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mockAddAccount).toHaveBeenCalledTimes(1);
    });
    expect(mockAddAccount.mock.calls[0][0].title).toBe("Test");
  });

  it("② addAccount 실패 (영문) → 인라인 에러 영역 + fallback 한국어", async () => {
    mockAddAccount.mockRejectedValueOnce(new Error("Invalid PIN"));
    const user = userEvent.setup();
    renderPage();

    const titleInput = screen.getByRole("textbox", { name: /제목|타이틀|title/i });
    await user.type(titleInput, "Test");

    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.getByTestId("account-edit-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("account-edit-error")).toHaveTextContent(
      "오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    );
  });

  it("②-2 addAccount 실패 (한국어 메시지) → 그대로 노출", async () => {
    mockAddAccount.mockRejectedValueOnce(new Error("저장 공간이 부족합니다"));
    const user = userEvent.setup();
    renderPage();

    const titleInput = screen.getByRole("textbox", { name: /제목|타이틀|title/i });
    await user.type(titleInput, "Test");

    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.getByTestId("account-edit-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("account-edit-error")).toHaveTextContent(
      "저장 공간이 부족합니다",
    );
  });

  it("③ 저장 성공 시 에러 영역 없음", async () => {
    mockAddAccount.mockResolvedValue({ id: 7 });
    const user = userEvent.setup();
    renderPage();

    const titleInput = screen.getByRole("textbox", { name: /제목|타이틀|title/i });
    await user.type(titleInput, "New");

    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mockAddAccount).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("account-edit-error")).not.toBeInTheDocument();
  });
});
