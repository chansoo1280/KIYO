import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { templateTable } from "@/database/templateTable";
import { syncDatabaseToFile } from "@/database/db";
import type { Template } from "@/models/template";
import { useSessionStore } from "@/store/sessionStore";

export interface TemplateState {
  templates: Template[];
  isLoading: boolean;
  loadTemplates: () => Promise<void>;
  createTemplate: (t: Omit<Template, "id" | "createdAt" | "updatedAt">) => Promise<Template>;
  updateTemplate: (id: string, patch: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  clearTemplates: () => Promise<void>;
  getTemplate: (id: string) => Template | undefined;
  _syncToFile: () => Promise<void>;
}

export const useTemplateStore = create<TemplateState>()(
  devtools(
    (set, get) => ({
      templates: [],
      isLoading: false,

      // Common sync helper
      _syncToFile: async () => {
        const sessionState = useSessionStore.getState();
        if (!sessionState.activeFileName) return;
        await syncDatabaseToFile({
          activeFileName: sessionState.activeFileName,
          cryptoKey: sessionState.cryptoKey,
          salt: sessionState.salt,
        });
      },

      loadTemplates: async () => {
        set({ isLoading: true });
        try {
          const sessionState = useSessionStore.getState();
          const dbTemplates = await templateTable.getAll(sessionState.cryptoKey ?? undefined);
          set({ templates: dbTemplates, isLoading: false });
        } catch (error) {
          console.error("Failed to load templates:", error);
          set({ isLoading: false });
        }
      },

      createTemplate: async (template) => {
        const sessionState = useSessionStore.getState();
        const newTemplate = await templateTable.create(template, sessionState.cryptoKey ?? undefined);
        set((state) => ({
          templates: [...state.templates, newTemplate].sort((a, b) => a.sortOrder - b.sortOrder),
        }));
        await get()._syncToFile();
        return newTemplate;
      },

      updateTemplate: async (id, patch) => {
        const sessionState = useSessionStore.getState();
        const template = get().templates.find((t) => t.id === id);
        if (template) {
          const updatedTemplate = { ...template, ...patch, updatedAt: Date.now() };
          await templateTable.update(updatedTemplate, sessionState.cryptoKey ?? undefined);
          set((state) => ({
            templates: state.templates
              .map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t))
              .sort((a, b) => a.sortOrder - b.sortOrder),
          }));
          await get()._syncToFile();
        }
      },

      deleteTemplate: async (id) => {
        await templateTable.delete(id);
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
        await get()._syncToFile();
      },

      clearTemplates: async () => {
        await templateTable.clear();
        set({ templates: [] });
        await get()._syncToFile();
      },

      getTemplate: (id) => get().templates.find((t) => t.id === id),
    }),
    { name: "TemplateStore" },
  ),
);