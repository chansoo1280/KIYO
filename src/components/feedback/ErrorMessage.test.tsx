import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorMessage from "./ErrorMessage";

describe("ErrorMessage", () => {
  it("renders null when items is null", () => {
    const { container } = render(<ErrorMessage items={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when items is undefined", () => {
    const { container } = render(<ErrorMessage items={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders single error as <p role=\"alert\">", () => {
    render(<ErrorMessage items="단일 에러" testId="test-error" />);
    const p = screen.getByTestId("test-error");
    expect(p).toBeInTheDocument();
    expect(p.tagName).toBe("P");
    expect(p).toHaveAttribute("role", "alert");
    expect(p).toHaveTextContent("단일 에러");
  });

  it("renders multiple errors as <ul role=\"alert\"><li>• {msg}</li></ul>", () => {
    render(<ErrorMessage items={["에러1", "에러2"]} testId="test-errors" />);
    const ul = screen.getByTestId("test-errors");
    expect(ul).toBeInTheDocument();
    expect(ul.tagName).toBe("UL");
    expect(ul).toHaveAttribute("role", "alert");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("• 에러1");
    expect(items[1]).toHaveTextContent("• 에러2");
  });

  it("renders null when items is empty array", () => {
    const { container } = render(<ErrorMessage items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});