import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AccountDetail from "./AccountDetail";

// AccountEdit.test.tsx 패턴 — mock fn은 외부, vi.mock factory는 literal
const mockDeleteAccount = vi.fn();
const mockUpdateAccount = vi.fn();

// mock factory 안에서 accounts literal 사용 — AccountEdit 패턴과 동일
// selector와 비-selector 호출 모두 지원
vi.mock("@/store/accountStore", () => ({
  useAccountStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      accounts: [
        {
          id: 1,
          title: "Gmail",
          tags: ["email"],
          fields: [
            { label: "email", type: "email", value: "test@gmail.com" },
            { label: "password", type: "password", value: "secret", order: 1 },
          ],
          favorite: false,
        },
      ],
      addAccount: () => undefined,
      updateAccount: mockUpdateAccount,
      deleteAccount: mockDeleteAccount,
    };
    if (typeof selector === "function") {
      return selector(state);
    }
    return state;
  },
}));

vi.mock("@/hooks/useFileAuthGuard", () => ({
  useFileAuthGuard: () => undefined,
}));

// useParams를 위한 Routes 정의
const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/accounts/1"]}>
      <Routes>
        <Route path="/accounts/:id" element={<AccountDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe("AccountDetail (Plan-A1)", () => {
  beforeEach(() => {
    mockDeleteAccount.mockReset();
    mockUpdateAccount.mockReset();
  });

  it("① 본체 렌더: Gmail 제목 + 수정/삭제/Favorite 버튼 표시", () => {
    renderDetail();
    expect(screen.getByText("Gmail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Favorite/ })).toBeInTheDocument();
  });

  it("② 삭제 버튼 클릭 → ConfirmDialog 열림", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    // 모달 안에 메시지 확인 (페이지의 h2 + 모달 메시지 둘 다 "Gmail" 포함)
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/Gmail/);
  });

  it("③ 삭제 성공 → deleteAccount 호출", async () => {
    mockDeleteAccount.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderDetail();

    // 페이지의 [삭제] 버튼
    await user.click(screen.getByRole("button", { name: "삭제" }));

    // 모달 안의 [삭제] 버튼 (danger variant)
    const dialog = await screen.findByRole("dialog");
    const dialogDeleteBtn = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "삭제",
    );
    expect(dialogDeleteBtn).toBeDefined();
    await user.click(dialogDeleteBtn!);

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith(1);
    });
  });

  it("④ 삭제 실패 → ConfirmDialog 닫히지 않고 에러 표시", async () => {
    mockDeleteAccount.mockRejectedValueOnce(new Error("fail"));
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: "삭제" }));

    const dialog = await screen.findByRole("dialog");
    const dialogDeleteBtn = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "삭제",
    );
    expect(dialogDeleteBtn).toBeDefined();
    await user.click(dialogDeleteBtn!);

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog-error")).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("⑤ Favorite 버튼 클릭 → updateAccount 호출", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: /Favorite/ }));

    await waitFor(() => {
      expect(mockUpdateAccount).toHaveBeenCalled();
    });
    const calledWith = mockUpdateAccount.mock.calls[0][0];
    expect(calledWith.favorite).toBe(true);
  });
});
