import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CreateVaultPage from "./index";

// createDataFile 모킹
vi.mock("@/database/fileStorage", () => ({
  createDataFile: vi.fn(),
}));

import { createDataFile } from "@/database/fileStorage";

const mockedCreateDataFile = vi.mocked(createDataFile);

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/create-vault"]}>
      <CreateVaultPage />
    </MemoryRouter>,
  );

describe("CreateVaultPage", () => {
  beforeEach(() => {
    mockedCreateDataFile.mockReset();
    mockedCreateDataFile.mockResolvedValue({} as never);
  });

  it("초기 렌더: Step 1 (이름) 표시", () => {
    renderPage();
    expect(screen.getByTestId("create-vault-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("create-vault-next")).toBeInTheDocument();
    expect(
      screen.queryByTestId("create-vault-pin-input"),
    ).not.toBeInTheDocument();
  });

  it("Stepper가 step=1로 렌더", () => {
    renderPage();
    const stepper = screen.getByTestId("create-vault-stepper");
    expect(stepper.querySelector('[data-state="current"]')).toHaveTextContent(
      "이름",
    );
  });

  it("validateName 실패 시 setError → 다음 버튼 disabled", async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByTestId("create-vault-name-input");
    await user.type(input, "bad/name");

    const button = screen.getByTestId("create-vault-next");
    expect(button).toBeDisabled();
    expect(screen.getByTestId("create-vault-name-error")).toBeInTheDocument();
  });

  it("정상 이름 입력 → 다음 클릭 → Step 2", async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByTestId("create-vault-name-input");
    await user.type(input, "my-vault");

    await user.click(screen.getByTestId("create-vault-next"));

    await waitFor(() => {
      expect(screen.getByTestId("create-vault-pin-input")).toBeInTheDocument();
    });
  });

  it("Step 2에서 이전 클릭 → PIN 클리어 + Step 1 (Q17-b)", async () => {
    const user = userEvent.setup();
    renderPage();

    // Step 1
    await user.type(screen.getByTestId("create-vault-name-input"), "test");
    await user.click(screen.getByTestId("create-vault-next"));

    // Step 2
    const pinInput = await screen.findByTestId("create-vault-pin-input");
    await user.type(pinInput, "1234");

    // 이전 클릭
    await user.click(screen.getByTestId("create-vault-back"));

    // Step 1로 돌아옴, fileName은 유지
    const nameInput = screen.getByTestId("create-vault-name-input");
    expect(nameInput).toHaveValue("test");

    // 다시 Step 2로
    await user.click(screen.getByTestId("create-vault-next"));

    // PIN은 클리어됨
    const pinInputAgain = await screen.findByTestId("create-vault-pin-input");
    expect(pinInputAgain).toHaveValue("");
  });

  it("submit 성공 시 createDataFile 호출 + /accounts navigate", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("create-vault-name-input"), "ok");
    await user.click(screen.getByTestId("create-vault-next"));

    const pinInput = await screen.findByTestId("create-vault-pin-input");
    await user.type(pinInput, "1234");
    await user.click(screen.getByTestId("create-vault-submit"));

    await waitFor(() => {
      expect(mockedCreateDataFile).toHaveBeenCalledWith("ok.json", "1234");
    });
  });

  it("비밀번호 없이 만들기: createDataFile(fileName) — PIN 없이 호출", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("create-vault-name-input"), "plain");
    await user.click(screen.getByTestId("create-vault-next"));

    const skipButton = await screen.findByTestId("create-vault-skip-pin");
    await user.click(skipButton);

    await waitFor(() => {
      expect(mockedCreateDataFile).toHaveBeenCalledWith("plain.json");
    });
    // PIN 인자가 undefined인지 확인
    const callArgs = mockedCreateDataFile.mock.calls[0];
    expect(callArgs.length).toBe(1); // PIN 미전달
  });

  it("submit 실패 시 에러 표시 + Step 2에 머무름", async () => {
    const user = userEvent.setup();
    mockedCreateDataFile.mockRejectedValueOnce(
      new Error("저장 공간이 부족합니다"),
    );

    renderPage();
    await user.type(screen.getByTestId("create-vault-name-input"), "ok");
    await user.click(screen.getByTestId("create-vault-next"));

    const pinInput = await screen.findByTestId("create-vault-pin-input");
    await user.type(pinInput, "1234");
    await user.click(screen.getByTestId("create-vault-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("create-vault-pin-error")).toHaveTextContent(
        "저장 공간이 부족합니다",
      );
    });

    // Step 2에 머무름
    expect(screen.getByTestId("create-vault-pin-input")).toBeInTheDocument();
  });

  it("입력 변경 시 에러 자동 클리어 (Q16-a)", async () => {
    const user = userEvent.setup();
    renderPage();

    const input = screen.getByTestId("create-vault-name-input");
    await user.type(input, "bad/name");

    expect(screen.getByTestId("create-vault-name-error")).toBeInTheDocument();

    // 정상 문자로 수정
    await user.clear(input);
    await user.type(input, "good");

    // 에러 사라짐
    expect(
      screen.queryByTestId("create-vault-name-error"),
    ).not.toBeInTheDocument();
  });
});
