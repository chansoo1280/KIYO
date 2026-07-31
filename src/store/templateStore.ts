import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { templateTable } from "../database/templateTable";
import type { Template } from "../models/template";

interface TemplateState {
  templates: Template[];
  isLoading: boolean;
  loadTemplates: () => Promise<void>;
  createTemplate: (t: Omit<Template, "id" | "createdAt" | "updatedAt">) => Promise<Template>;
  updateTemplate: (id: string, patch: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  reorderTemplates: (ids: string[]) => Promise<void>;
  getTemplate: (id: string) => Template | undefined;
}

export const useTemplateStore = create<TemplateState>()(
  devtools(
    (set, get) => ({
      templates: [],
      isLoading: false,
      loadTemplates: async () => {
        set({ isLoading: true });
        try {
          const dbTemplates = await templateTable.getAll();
          set({ templates: dbTemplates, isLoading: false });
        } catch (error) {
          console.error("Failed to load templates:", error);
          set({ isLoading: false });
        }
      },

      createTemplate: async (template) => {
        const newTemplate = await templateTable.create(template);
        set((state) => ({
          templates: [...state.templates, newTemplate].sort((a, b) => a.sortOrder - b.sortOrder),
        }));
        return newTemplate;
      },

      updateTemplate: async (id, patch) => {
        await templateTable.update(id, patch);
        set((state) => ({
          templates: state.templates
            .map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }));
      },

      deleteTemplate: async (id) => {
        await templateTable.delete(id);
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      reorderTemplates: async (ids) => {
        await templateTable.reorder(ids);
        set((state) => ({
          templates: ids
            .map((id, index) => {
              const template = state.templates.find((t) => t.id === id);
              if (template) return { ...template, sortOrder: index, updatedAt: Date.now() };
              return null;
            })
            .filter((t): t is Template => t !== null),
        }));
      },

      getTemplate: (id) => get().templates.find((t) => t.id === id),
    }),
    { name: "TemplateStore" },
  ),
);