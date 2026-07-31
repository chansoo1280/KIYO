import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTemplateStore } from "./templateStore";
import { templateTable } from "../database/templateTable";
import type { Template } from "../models/template";
import { BUILTIN_TEMPLATES } from "../data/builtinTemplates";

// templateTable 모듈 전체 모킹 (내부에서 db 사용하므로)
vi.mock("../database/templateTable", () => ({
  templateTable: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("templateStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTemplateStore.setState({
      templates: [],
      isLoading: false,
    });
  });

  describe("loadTemplates", () => {
    it("DB가 비어있으면 내장 템플릿 6개를 시드하고 로드한다", async () => {
      // createDataFile에서 templateTable.init()을 호출하여 시드함
      // loadTemplates에서는 이미 시드된 데이터(getAll 반환)를 로드
      const seededTemplates = BUILTIN_TEMPLATES.map((t, i) => ({
        ...t,
        id: `seed-${i}`,
        createdAt: 1000 + i,
        updatedAt: 1000 + i,
      }));
      // templateTable.getAll()이 시드된 템플릿 반환 (init에서 시드 완료 후)
      vi.fn(templateTable.getAll).mockResolvedValueOnce(seededTemplates);

      await useTemplateStore.getState().loadTemplates();

      const state = useTemplateStore.getState();
      expect(state.templates).toHaveLength(6);
      expect(state.templates.map((t) => t.name)).toEqual([
        "로그인",
        "API 키",
        "신용/체크카드",
        "은행 계좌",
        "Wi-Fi",
        "보안 메모",
      ]);
      // create는 init에서 호출됨, loadTemplates에서는 호출되지 않음
      expect(templateTable.create).not.toHaveBeenCalled();
    });

    it("DB에 데이터가 있으면 시드 없이 그대로 로드한다", async () => {
      const existingTemplates: Template[] = [
        {
          id: "c1",
          name: "커스텀 템플릿",
          description: "",
          icon: "🔧",
          sortOrder: 0,
          fields: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      // templateTable.getAll()이 기존 데이터 반환 (init에서 이미 데이터 있음 확인)
      vi.fn(templateTable.getAll).mockResolvedValueOnce(existingTemplates);

      await useTemplateStore.getState().loadTemplates();

      const state = useTemplateStore.getState();
      expect(state.templates).toHaveLength(1);
      expect(state.templates[0].name).toBe("커스텀 템플릿");
      expect(templateTable.create).not.toHaveBeenCalled();
    });

    it("에러 발생 시 isLoading만 false로 설정한다", async () => {
      vi.fn(templateTable.getAll).mockRejectedValueOnce(new Error("DB error"));

      await useTemplateStore.getState().loadTemplates();

      const state = useTemplateStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.templates).toHaveLength(0);
    });
  });

  describe("createTemplate", () => {
      it("템플릿을 생성하고 스토어에 추가 후 정렬한다", async () => {
        const newTemplate: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
          name: "새 템플릿",
          description: "설명",
          icon: "🆕",
          sortOrder: 10,
          fields: [{ label: "필드", type: "text", placeholder: "", defaultValue: "", options: [] }],
        };

        const created: Template = {
          ...newTemplate,
          id: "new-id",
          createdAt: 1000,
          updatedAt: 1000,
        };

        vi.fn(templateTable.create).mockResolvedValueOnce(created);

        const result = await useTemplateStore.getState().createTemplate(newTemplate);

        expect(result).toEqual(created);
        const state = useTemplateStore.getState();
        expect(state.templates).toContainEqual(created);
        expect(state.templates[0].sortOrder).toBe(10);
      });
    });
  describe("updateTemplate", () => {
    it("기존 템플릿을 수정하고 updatedAt을 갱신한다", async () => {
      const existing: Template = {
        id: "t1",
        name: "원본",
        description: "",
        icon: "📋",
        sortOrder: 0,
        fields: [],
        createdAt: 1000,
        updatedAt: 1000,
      };
      useTemplateStore.setState({ templates: [existing] });


      await useTemplateStore.getState().updateTemplate("t1", { name: "수정된 이름" });

      const state = useTemplateStore.getState();
      expect(state.templates[0].name).toBe("수정된 이름");
      expect(state.templates[0].updatedAt).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("deleteTemplate", () => {
    it("템플릿을 삭제하고 스토어에서 제거한다", async () => {
      const templates: Template[] = [
        { id: "t1", name: "템플릿1", description: "", icon: "📋", sortOrder: 0, fields: [], createdAt: 1, updatedAt: 1 },
        { id: "t2", name: "템플릿2", description: "", icon: "📋", sortOrder: 1, fields: [], createdAt: 1, updatedAt: 1 },
      ];
      useTemplateStore.setState({ templates });

      await useTemplateStore.getState().deleteTemplate("t1");

      const state = useTemplateStore.getState();
      expect(state.templates).toHaveLength(1);
      expect(state.templates[0].id).toBe("t2");
    });
  });

  describe("reorderTemplates", () => {
    it("ID 배열 순서대로 sortOrder를 재설정한다", async () => {
      const templates: Template[] = [
        { id: "t1", name: "A", description: "", icon: "📋", sortOrder: 0, fields: [], createdAt: 1, updatedAt: 1 },
        { id: "t2", name: "B", description: "", icon: "📋", sortOrder: 1, fields: [], createdAt: 1, updatedAt: 1 },
        { id: "t3", name: "C", description: "", icon: "📋", sortOrder: 2, fields: [], createdAt: 1, updatedAt: 1 },
      ];
      useTemplateStore.setState({ templates });

      await useTemplateStore.getState().reorderTemplates(["t3", "t1", "t2"]);

      const state = useTemplateStore.getState();
      expect(state.templates.find((t) => t.id === "t3")?.sortOrder).toBe(0);
      expect(state.templates.find((t) => t.id === "t1")?.sortOrder).toBe(1);
      expect(state.templates.find((t) => t.id === "t2")?.sortOrder).toBe(2);
    });
  });
});