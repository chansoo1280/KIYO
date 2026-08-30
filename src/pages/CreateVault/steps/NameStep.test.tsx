import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NameStep, validateName, NAME_MAX_LENGTH } from "./NameStep";

describe("validateName", () => {
  it("빈 문자열은 null (조용히 disabled)", () => {
    expect(validateName("")).toBeNull();
    expect(validateName("   ")).toBeNull();
  });

  it("정상 이름은 null", () => {
    expect(validateName("my-accounts")).toBeNull();
    expect(validateName("vault1")).toBeNull();
  });

  it(`${NAME_MAX_LENGTH}자 이하는 정상`, () => {
    const name = "a".repeat(NAME_MAX_LENGTH);
    expect(validateName(name)).toBeNull();
  });

  it(`${NAME_MAX_LENGTH + 1}자 초과는 에러`, () => {
    const name = "a".repeat(NAME_MAX_LENGTH + 1);
    expect(validateName(name)).toContain(`${NAME_MAX_LENGTH}자 이하`);
  });

  it.each([
    ["test/file", "/"],
    ["test\\file", "\\"],
    ["test:name", ":"],
    ["test*name", "*"],
    ["test?name", "?"],
    ['test"name', '"'],
    ["test<name", "<"],
    ["test>name", ">"],
    ["test|name", "|"],
    ["test\x00name", "NUL"],
  ])("위험 문자 %j 포함 → 에러", (name) => {
    const result = validateName(name);
    expect(result).not.toBeNull();
    expect(result).toContain("문자를 사용할 수 없습니다");
  });
});

describe("NameStep component", () => {
  const defaultProps = {
    fileName: "",
    defaultValue: "my-accounts",
    onFileNameChange: vi.fn(),
    onNext: vi.fn(),
  };

  it("정상 입력 시 다음 버튼 활성화", () => {
    render(<NameStep {...defaultProps} fileName="valid-name" />);
    const button = screen.getByTestId("create-vault-next");
    expect(button).toBeEnabled();
  });

  it("빈 입력 시 다음 버튼 enabled (defaultValue로 채움)", () => {
    render(<NameStep {...defaultProps} fileName="" />);
    expect(screen.getByTestId("create-vault-next")).toBeEnabled();
  });

  it("빈 입력에서 다음 클릭 시 defaultValue로 onFileNameChange 호출", () => {
    const onFileNameChange = vi.fn();
    const onNext = vi.fn();
    render(
      <NameStep
        {...defaultProps}
        fileName=""
        defaultValue="my-accounts"
        onFileNameChange={onFileNameChange}
        onNext={onNext}
      />,
    );
    screen.getByTestId("create-vault-next").click();
    expect(onFileNameChange).toHaveBeenCalledWith("my-accounts");
    expect(onNext).toHaveBeenCalled();
  });

  it("입력이 있으면 defaultValue 무시하고 입력값 그대로 onNext", () => {
    const onFileNameChange = vi.fn();
    const onNext = vi.fn();
    render(
      <NameStep
        {...defaultProps}
        fileName="custom"
        defaultValue="my-accounts"
        onFileNameChange={onFileNameChange}
        onNext={onNext}
      />,
    );
    screen.getByTestId("create-vault-next").click();
    expect(onFileNameChange).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });

  it("defaultValue가 위험 문자면 disabled (예: 'bad/name')", () => {
    render(
      <NameStep
        {...defaultProps}
        fileName=""
        defaultValue="bad/name"
      />,
    );
    expect(screen.getByTestId("create-vault-next")).toBeDisabled();
  });

  it("placeholder가 defaultValue 표시", () => {
    render(
      <NameStep
        {...defaultProps}
        fileName=""
        defaultValue="my-custom"
      />,
    );
    const input = screen.getByTestId("create-vault-name-input");
    expect(input).toHaveAttribute("placeholder", "my-custom");
  });

  it("위험 문자가 있으면 validateName 에러 메시지 표시", () => {
    render(<NameStep {...defaultProps} fileName="bad/name" />);
    expect(screen.getByTestId("create-vault-name-error")).toHaveTextContent(
      "문자를 사용할 수 없습니다",
    );
  });

  it("에러 prop은 미사용 (validation이 직접 표시)", () => {
    // validation이 없으면 메시지 미렌더 (test 단순화)
    render(<NameStep {...defaultProps} fileName="valid" />);
    expect(
      screen.queryByTestId("create-vault-name-error"),
    ).not.toBeInTheDocument();
  });

  it("입력 변경 시 onFileNameChange 호출", () => {
    const onChange = vi.fn();
    render(
      <NameStep
        {...defaultProps}
        fileName=""
        onFileNameChange={onChange}
      />,
    );
    const input = screen.getByTestId("create-vault-name-input");
    input.focus();
    // fireEvent.change가 React에서 input value 업데이트 안 될 수 있음 — 직접 dispatch
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeInputValueSetter?.call(input, "new-value");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith("new-value");
  });
});
