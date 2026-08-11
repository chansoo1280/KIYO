import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { templateTable } from "@/database/templateTable";
import { syncDatabaseToFile } from "@/database/db";
import type { Template } from "@/models/template";
import { useSessionStore } from "@/store/sessionStore";

export interface TemplateState {
  templates: Template[];
  isLoading: boolean;
  initialized: boolean;
  loadTemplates: () => Promise<void>;
  createTemplate: (t: Omit<Template, "id" | "createdAt" | "updatedAt">) => Promise<Template>;
  updateTemplate: (id: string, patch: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  clearTemplates: () => Promise<void>;
  getTemplate: (id: string) => Template | undefined;
}

export const useTemplateStore = create<TemplateState>()(
  devtools(
    (set, get) => ({
      templates: [],
      isLoading: false,
      initialized: false,

      loadTemplates: async () => {
        set({ isLoading: true });
        try {
          const sessionState = useSessionStore.getState();
          const dbTemplates = await templateTable.getAll(sessionState.cryptoKey ?? undefined);
          set({ templates: dbTemplates, isLoading: false, initialized: true });
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
        await syncDatabaseToFile({
          activeFileName: sessionState.activeFileName,
          cryptoKey: sessionState.cryptoKey,
          salt: sessionState.salt,
        });
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
          await syncDatabaseToFile({
            activeFileName: sessionState.activeFileName,
            cryptoKey: sessionState.cryptoKey,
            salt: sessionState.salt,
          });
        }
      },

      deleteTemplate: async (id) => {
        await templateTable.delete(id);
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));

        const sessionState = useSessionStore.getState();
        await syncDatabaseToFile({
          activeFileName: sessionState.activeFileName,
          cryptoKey: sessionState.cryptoKey,
          salt: sessionState.salt,
        });
      },

      clearTemplates: async () => {
        await templateTable.clear();
        set({ templates: [] });

        const sessionState = useSessionStore.getState();
        await syncDatabaseToFile({
          activeFileName: sessionState.activeFileName,
          cryptoKey: sessionState.cryptoKey,
          salt: sessionState.salt,
        });
      },

      getTemplate: (id) => get().templates.find((t) => t.id === id),
    }),
    { name: "TemplateStore" },
  ),
);