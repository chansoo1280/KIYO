import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormDialog } from "@/components/dialogs/FormDialog";

describe("FormDialog (Plan-4 follow-up: 에러 표시)", () => {
  it("onSubmit 성공 시 에러 메시지 표시 안 함", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <FormDialog open={true} title="테스트" onClose={() => {}} onSubmit={onSubmit}>
        <input data-testid="child-input" />
      </FormDialog>,
    );

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(onSubmit).toHaveBeenCalled();
    expect(screen.queryByTestId("form-dialog-error")).not.toBeInTheDocument();
  });

  it("onSubmit이 일반 Error throw → 에러 메시지를 다이얼로그 안에 표시", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("파일 이름을 입력해주세요."));
    render(
      <FormDialog open={true} title="테스트" onClose={() => {}} onSubmit={onSubmit}>
        <input />
      </FormDialog>,
    );

    await user.click(screen.getByRole("button", { name: "확인" }));

    const errorEl = await screen.findByTestId("form-dialog-error");
    expect(errorEl.textContent).toBe("파일 이름을 입력해주세요.");
    expect(errorEl.getAttribute("role")).toBe("alert");
  });

  it("onSubmit이 CryptoUnavailableError throw → 'HTTPS 또는 localhost' 안내", async () => {
    const user = userEvent.setup();
    const { CryptoUnavailableError } = await import("@/crypto/crypto.utils");
    const onSubmit = vi.fn().mockRejectedValue(
      new CryptoUnavailableError("Web Crypto API를 사용할 수 없는 환경입니다."),
    );
    render(
      <FormDialog open={true} title="테스트" onClose={() => {}} onSubmit={onSubmit}>
        <input />
      </FormDialog>,
    );

    await user.click(screen.getByRole("button", { name: "확인" }));

    const errorEl = await screen.findByTestId("form-dialog-error");
    expect(errorEl.textContent).toBe(
      "이 환경에서는 암호화 기능을 사용할 수 없습니다. HTTPS 또는 localhost로 접속해주세요.",
    );
  });

  it("onSubmit이 'Cannot read properties of undefined (reading crypto.subtle.importKey)' 패턴 throw → 안내 메시지로 변환", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new TypeError("Cannot read properties of undefined (reading 'importKey')"),
      );
    render(
      <FormDialog open={true} title="테스트" onClose={() => {}} onSubmit={onSubmit}>
        <input />
      </FormDialog>,
    );

    await user.click(screen.getByRole("button", { name: "확인" }));

    const errorEl = await screen.findByTestId("form-dialog-error");
    expect(errorEl.textContent).toBe(
      "이 환경에서는 암호화 기능을 사용할 수 없습니다. HTTPS 또는 localhost로 접속해주세요.",
    );
  });

  it("onSubmit 성공 후 다시 throw → 새 에러로 업데이트", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("두 번째 시도 실패"));
    render(
      <FormDialog open={true} title="테스트" onClose={() => {}} onSubmit={onSubmit}>
        <input />
      </FormDialog>,
    );

    // 1차: 성공 → 에러 없음
    await user.click(screen.getByRole("button", { name: "확인" }));
    expect(screen.queryByTestId("form-dialog-error")).not.toBeInTheDocument();

    // 2차: 실패 → 에러 표시
    await user.click(screen.getByRole("button", { name: "확인" }));
    const errorEl = await screen.findByTestId("form-dialog-error");
    expect(errorEl.textContent).toBe("두 번째 시도 실패");
  });

  it("취소 버튼 클릭 시 내부 에러 클림 + onClose 호출", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error("테스트 에러"));
    render(
      <FormDialog open={true} title="테스트" onClose={onClose} onSubmit={onSubmit}>
        <input />
      </FormDialog>,
    );

    // 에러 발생시키기
    await user.click(screen.getByRole("button", { name: "확인" }));
    await screen.findByTestId("form-dialog-error");

    // 취소 → 에러 클림
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("외부 errorMessage prop이 있으면 그것을 우선 표시", async () => {
    render(
      <FormDialog
        open={true}
        title="테스트"
        onClose={() => {}}
        onSubmit={async () => {}}
        errorMessage="외부 prop 에러"
      >
        <input />
      </FormDialog>,
    );

    expect(screen.getByTestId("form-dialog-error").textContent).toBe("외부 prop 에러");
  });
});