import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Template } from "@/models/template";
import { saveStoresToFile } from "@/database/fileStorage";

export interface TemplateState {
  templates: Template[];
  init: (templates: Template[]) => void;
  getAll: () => Template[];
  addTemplate: (t: Omit<Template, "id" | "createdAt" | "updatedAt">) => Promise<Template>;
  updateTemplate: (id: string, patch: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  clearTemplates: () => Promise<void>;
  getTemplate: (id: string) => Template | undefined;
}

export const useTemplateStore = create<TemplateState>()(
  devtools(
    (set, get) => ({
      templates: [],

      init: (templates: Template[]) => {
        set({ templates: [...templates].sort((a, b) => a.sortOrder - b.sortOrder) });
      },

      getAll: () => get().templates,

      addTemplate: async (template) => {
        const newTemplate: Template = {
          ...template,
          id: String(Date.now()), // Use timestamp as unique ID
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          templates: [...state.templates, newTemplate].sort((a, b) => a.sortOrder - b.sortOrder),
        }));
        await saveStoresToFile();
        return newTemplate;
      },

      updateTemplate: async (id, patch) => {
        const template = get().templates.find((t) => t.id === id);
        if (template) {
          set((state) => ({
            templates: state.templates
              .map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t))
              .sort((a, b) => a.sortOrder - b.sortOrder),
          }));
          await saveStoresToFile();
        }
      },

      deleteTemplate: async (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
        await saveStoresToFile();
      },

      clearTemplates: async () => {
        set({ templates: [] });
        await saveStoresToFile();
      },

      getTemplate: (id) => get().templates.find((t) => t.id === id),
    }),
    { name: "TemplateStore" }
  )
);

// Dev/테스트 환경에서 Zustand store 디버그용 노출
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__KIYO_DEBUG__ = {
    ...((window as unknown as Record<string, unknown>).__KIYO_DEBUG__ ?? {}),
    getTemplateStore: () => {
      const state = useTemplateStore.getState();
      return {
        templatesCount: state.templates.length,
      };
    },
  };
}