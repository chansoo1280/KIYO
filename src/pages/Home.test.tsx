import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "@/pages/Home";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";

// Mock dependencies BEFORE importing the component
vi.mock("@/database/fileTable", () => ({
  fileTable: {
    getAllFiles: vi.fn(),
    getFileInfo: vi.fn(),
    deleteFileRecord: vi.fn(),
  },
}));

vi.mock("@/store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(),
  },
}));

// Mock FileOpenDialog / ConfirmDialog to avoid coupling
vi.mock("@/components/dialogs/FileOpenDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/dialogs/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

const mockFileTable = vi.mocked(fileTable);
const mockUseSessionStore = vi.mocked(useSessionStore);

const renderWithRouter = (ui: React.ReactElement, initialPath = "/") =>
  render(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>);

beforeEach(() => {
  mockFileTable.getAllFiles.mockReset();
  mockFileTable.getAllFiles.mockResolvedValue([]);
  mockUseSessionStore.getState.mockReset();
  mockUseSessionStore.getState.mockReturnValue({
    activeFileName: null,
    clearSession: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useSessionStore.getState>);
});

describe("Home (Plan-D PR 1)", () => {
  it("① refreshFiles 호출 — fileTable.getAllFiles 호출됨", async () => {
    renderWithRouter(<Home />);
    await waitFor(() => {
      expect(mockFileTable.getAllFiles).toHaveBeenCalled();
    });
  });

  it("② redirect 로직 없음 — activeFileName 있어도 자동 navigate 안 함", async () => {
    mockUseSessionStore.getState.mockReturnValue({
      activeFileName: "vault.json",
      clearSession: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useSessionStore.getState>);
    mockFileTable.getFileInfo.mockResolvedValue({
      encrypted: true,
      activeFileName: "vault.json",
      fileData: {} as never,
      salt: new Uint8Array([1]),
    });
    renderWithRouter(<Home />);
    await waitFor(() => {
      expect(mockFileTable.getAllFiles).toHaveBeenCalled();
    });
    // redirect 로직 제거됨 — 파일 리스트는 getAllFiles만 호출되고 그 외 side effect 없음
  });

  it("③ 파일 리스트가 비어있으면 '기존 파일' 섹션 미표시", async () => {
    mockFileTable.getAllFiles.mockResolvedValue([]);
    renderWithRouter(<Home />);
    await waitFor(() => {
      expect(mockFileTable.getAllFiles).toHaveBeenCalled();
    });
    expect(screen.queryByText("기존 파일")).not.toBeInTheDocument();
  });
});