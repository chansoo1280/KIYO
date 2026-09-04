import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { FileStorageError, FileStorageErrorCode } from "@/database/fileStorage.error";
import TemplateEdit from "./index";

// mock fn은 외부, vi.mock factory는 literal (AccountDetail 패턴 일관)
const mockCreateTemplate = vi.fn();
const mockUpdateTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();
const mockLoadTemplates = vi.fn();

// selector와 비-selector 호출 모두 지원 (AccountDetail.test.tsx:14 패턴)
vi.mock("@/store/templateStore", () => ({
  useTemplateStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      templates: [
        {
          id: "tmpl-1",
          name: "로그인",
          description: "기본 로그인",
          icon: "📋",
          sortOrder: 0,
          fields: [
            { label: "아이디", type: "text" },
            { label: "비밀번호", type: "password" },
          ],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      isLoading: false,
      initialized: true,
      loadTemplates: mockLoadTemplates,
      createTemplate: mockCreateTemplate,
      updateTemplate: mockUpdateTemplate,
      deleteTemplate: mockDeleteTemplate,
      // lazy initializer가 form을 채울 수 있도록 기존 템플릿 반환
      getTemplate: () => ({
        id: "tmpl-1",
        name: "로그인",
        description: "기본 로그인",
        icon: "📋",
        sortOrder: 0,
        fields: [
          { label: "아이디", type: "text" as const, defaultValue: "", options: [] },
          { label: "비밀번호", type: "password" as const, defaultValue: "", options: [] },
        ],
        createdAt: 1000,
        updatedAt: 1000,
      }),
    };
    if (typeof selector === "function") {
      return selector(state);
    }
    return state;
  },
}));

// useFileAuthGuard는 TemplateEdit가 직접 호출하지 않지만 ConfirmDialog 등
// 자식이 의존할 수 있으니 안전하게 stub
vi.mock("@/hooks/useFileAuthGuard", () => ({
  useFileAuthGuard: () => undefined,
}));

// 신규 페이지 라우트 패턴 — useParams(":id") 지원
const renderEdit = (path = "/templates/tmpl-1/edit") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/templates/:id/edit" element={<TemplateEdit />} />
        <Route path="/templates/new" element={<TemplateEdit />} />
        <Route path="/templates" element={<div>templates-list</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("TemplateEdit (Plan-B-3 + Plan-A1 catch 회귀)", () => {
  beforeEach(() => {
    mockCreateTemplate.mockReset();
    mockUpdateTemplate.mockReset();
    mockDeleteTemplate.mockReset();
    mockLoadTemplates.mockReset();
  });

  it("① Button 렌더: 4개 인라인 버튼이 <Button> 컴포넌트로 마이그레이션됨 (data-testid='button')", () => {
    renderEdit();

    // Plan-B-3-A §2: 4개 버튼 (삭제/취소/저장/+ 필드 추가)
    // Button.tsx:50 — 모든 Button에 data-testid="button" 자동 부여
    const buttons = screen.getAllByTestId("button");
    expect(buttons.length).toBeGreaterThanOrEqual(4);

    // 라벨 검증 (label prop이 accessible name)
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ 필드 추가" })).toBeInTheDocument();
  });

  it("② 저장 catch — Plan-A1 mapError 경로: updateTemplate reject 시 setErrors([mapError(err)])로 가시화", async () => {
    // Arrange: updateTemplate가 FileStorageError(PIN_MISMATCH) reject
    // mapError의 isFileStorageError()는 instanceof 체크이므로 정통 생성자 사용 필수
    const fileStorageError = FileStorageError.create(
      FileStorageErrorCode.PIN_MISMATCH,
      "PIN mismatch",
    );
    mockUpdateTemplate.mockRejectedValueOnce(fileStorageError);

    renderEdit();

    // Act: 저장 버튼 클릭
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "저장" }));

    // Assert: catch 블록이 호출되어 errors state가 갱신됨 — Plan-A1 결정 (#3)
    // 정확한 한국어 메시지는 Plan-A1 mapError 책임 (utils/mapError.test.ts에서 검증됨)
    // Plan-B-3은 Button 마이그레이션 중 catch 로직 회귀 0만 검증
    //   → updateTemplate가 reject되면 setErrors([mapError(err)])로 한국어 메시지 표시
    //   → navigate("/templates")는 호출되지 않음 (실패 시 머무름)
    await waitFor(() => {
      // 검증 에러("이름을 입력해주세요")가 사라지고 catch의 mapError 결과로 교체됨
      // "PIN"이 포함된 한국어 메시지("PIN 번호가 올바르지 않습니다.")가 나타남
      expect(screen.getByText(/PIN/)).toBeInTheDocument();
    });

    // navigate("/templates")는 호출되지 않아야 함 (실패 시 머무름)
    expect(mockUpdateTemplate).toHaveBeenCalledTimes(1);
    // list 페이지로 navigate 안 됐는지 — 텍스트가 보이지 않음으로 검증
    expect(screen.queryByText("templates-list")).not.toBeInTheDocument();
  });

  it("③ 삭제 catch — Plan-A1 mapError + setShowDeleteConfirm(false) 호출 안 함: 모달 유지 + 에러 가시화", async () => {
    // Arrange: deleteTemplate reject (FileStorageError.FILE_DELETE_ERROR)
    // mapError의 isFileStorageError()는 instanceof 체크이므로 정통 생성자 사용 필수
    const fileStorageError = FileStorageError.create(
      FileStorageErrorCode.FILE_DELETE_ERROR,
      "Delete failed",
    );
    mockDeleteTemplate.mockRejectedValueOnce(fileStorageError);

    renderEdit();

    const user = userEvent.setup();

    // 1단계: 삭제 버튼 클릭 → ConfirmDialog open
    await user.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => {
      // ConfirmDialog 제목 노출
      expect(screen.getByText("템플릿 삭제")).toBeInTheDocument();
    });

    // 2단계: ConfirmDialog 내부 "삭제" 버튼 클릭 → handleDelete 실행 → reject
    const confirmButton = screen.getAllByRole("button", { name: "삭제" })[1];
    await user.click(confirmButton);

    // Assert: 모달이 닫히지 않음 (Plan-A1 §3 #4 결정)
    await waitFor(() => {
      expect(screen.getByText("템플릿 삭제")).toBeInTheDocument();
    });

    // Assert: ConfirmDialog error prop으로 mapError 결과 표시
    // 정확한 한국어 메시지는 Plan-A1 mapError 책임, Plan-B-3은 회귀 가드만
    await waitFor(() => {
      // mapError의 FILE_DELETE_ERROR → "파일을 삭제할 수 없습니다."
      expect(screen.getByText(/파일을 삭제할 수 없습니다/)).toBeInTheDocument();
    });

    // Assert: deleteTemplate는 호출됨
    expect(mockDeleteTemplate).toHaveBeenCalledTimes(1);
    // Assert: navigate 안 됨 (목록 페이지 텍스트 없음)
    expect(screen.queryByText("templates-list")).not.toBeInTheDocument();
  });
});