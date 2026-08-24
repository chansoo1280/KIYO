import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import TemplatePicker from "@/pages/Accounts/components/TemplatePicker";
import { useTemplateStore } from "@/store/templateStore";

// Mock template store
vi.mock("@/store/templateStore", () => ({
  useTemplateStore: vi.fn(()=>({
      templates: [],
      loadTemplates: vi.fn(),
    })),
}));
const mockUseTemplateStore = vi.mocked(useTemplateStore);
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("TemplatePicker - Component Tests", () => {
  const mockTemplates = [
    {
      id: "template-1",
      name: "로그인 계정",
      description: "아이디/비밀번호 방식",
      icon: "🔐",
      sortOrder: 0,
      fields: [
        { id: "f1", type: "username", label: "아이디", required: true, placeholder: "", options: [], sortOrder: 0 },
        { id: "f2", type: "password", label: "비밀번호", required: true, placeholder: "", options: [], sortOrder: 1 },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: "template-2",
      name: "카드 정보",
      description: "신용/체크카드",
      icon: "💳",
      sortOrder: 1,
      fields: [
        { id: "f3", type: "text", label: "카드번호", required: true, placeholder: "", options: [], sortOrder: 0 },
        { id: "f4", type: "text", label: "유효기간", required: true, placeholder: "", options: [], sortOrder: 1 },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("open=false일 때 아무것도 렌더링하지 않음", () => {
    renderWithRouter(<TemplatePicker open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true일 때 다이얼로그 렌더링", () => {
    renderWithRouter(<TemplatePicker open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("템플릿 선택")).toBeInTheDocument();
    expect(screen.getByText("기본 항목을 선택한 뒤 내용을 입력하세요.")).toBeInTheDocument();
  });

  it("기본 템플릿이 항상 첫 번째에 표시됨", () => {
    (mockUseTemplateStore).mockReturnValue({
      templates: mockTemplates,
      loadTemplates: vi.fn(),
    });
    
    renderWithRouter(<TemplatePicker open={true} onClose={vi.fn()} />);
    
    // 기본 템플릿이 첫 번째
    expect(screen.getByText("기본 템플릿")).toBeInTheDocument();
    expect(screen.getByText("간단한 입력 항목만 있는 기본 템플릿")).toBeInTheDocument();
    // 텍스트가 여러 요소로 나뉘어 있어서 regex로 찾기 어려움 - 기본 템플릿이 첫 번째 버튼인지 확인
    const buttons = screen.getAllByRole("button", { name: /기본 템플릿|로그인 계정|카드 정보/ });
    expect(buttons[0]).toHaveTextContent("기본 템플릿");
  });

  it("사용자 템플릿이 기본 템플릿 뒤에 표시됨", () => {
    (mockUseTemplateStore).mockReturnValue({
      templates: mockTemplates,
      loadTemplates: vi.fn(),
    });
    
    renderWithRouter(<TemplatePicker open={true} onClose={vi.fn()} />);
    
    expect(screen.getByText("로그인 계정")).toBeInTheDocument();
    expect(screen.getByText("아이디/비밀번호 방식")).toBeInTheDocument();
    
    expect(screen.getByText("카드 정보")).toBeInTheDocument();
    expect(screen.getByText("신용/체크카드")).toBeInTheDocument();
    
    // 템플릿 버튼이 총 3개 (기본 + 2개 사용자)
    const templateButtons = screen.getAllByRole("button", { name: /기본 템플릿|로그인 계정|카드 정보/ });
    expect(templateButtons).toHaveLength(3);
  });

  it("템플릿 선택 시 onClose 호출 후 네비게이션", () => {
    const onClose = vi.fn();
    (mockUseTemplateStore).mockReturnValue({
      templates: mockTemplates,
      loadTemplates: vi.fn(),
    });
    
    renderWithRouter(<TemplatePicker open={true} onClose={onClose} />);
    
    fireEvent.click(screen.getByText("로그인 계정"));
    
    expect(onClose).toHaveBeenCalledTimes(1);
    // 네비게이션은 내부 처리
  });

  it("닫기 버튼 클릭 시 onClose 호출", () => {
    const onClose = vi.fn();
    renderWithRouter(<TemplatePicker open={true} onClose={onClose} />);
    
    fireEvent.click(screen.getByLabelText("템플릿 선택 닫기"));
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("오버레이 클릭 시 onClose 호출", () => {
    const onClose = vi.fn();
    renderWithRouter(<TemplatePicker open={true} onClose={onClose} />);
    
    fireEvent.click(screen.getByRole("dialog"));
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("빈 이름 템플릿은 표시되지 않음", () => {
    (mockUseTemplateStore).mockReturnValue({
      templates: [
        { ...mockTemplates[0], name: "" },
        mockTemplates[1],
      ],
      loadTemplates: vi.fn(),
    });
    
    renderWithRouter(<TemplatePicker open={true} onClose={vi.fn()} />);
    
    // 기본 템플릿 + 유효한 템플릿 1개만
    expect(screen.getByText("기본 템플릿")).toBeInTheDocument();
    expect(screen.getByText("카드 정보")).toBeInTheDocument();
    expect(screen.queryByText("로그인 계정")).not.toBeInTheDocument(); // 빈 이름은 필터링
  });

  it("템플릿 아이콘이 표시됨", () => {
    (mockUseTemplateStore).mockReturnValue({
      templates: mockTemplates,
      loadTemplates: vi.fn(),
    });
    
    renderWithRouter(<TemplatePicker open={true} onClose={vi.fn()} />);
    
    expect(screen.getByText("🔐")).toBeInTheDocument();
    expect(screen.getByText("💳")).toBeInTheDocument();
    expect(screen.getByText("📝")).toBeInTheDocument(); // 기본 템플릿
  });
});