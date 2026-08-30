import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { templateTable } from "@/database/templateTable";
import { enqueuePersistVaultSnapshot } from "@/database/syncQueue";
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
          // multi-vault: reload 직후 또는 lock 상태에서 encrypted records가 있고
          // cryptoKey가 없는 경우 throw. 사용자 영향 0 (unlock 후 initializeStores로
          // 정상 로드). 콘솔 노이즈만 남김.
          console.error("Failed to load templates:", error instanceof Error ? error.message : String(error));
          set({ isLoading: false });
        }
      },

      createTemplate: async (template) => {
        const sessionState = useSessionStore.getState();
        const newTemplate = await templateTable.create(template, sessionState.cryptoKey ?? undefined);
        set((state) => ({
          templates: [...state.templates, newTemplate].sort((a, b) => a.sortOrder - b.sortOrder),
        }));
        await enqueuePersistVaultSnapshot(() => {
          const s = useSessionStore.getState();
          return {
            activeFileName: s.activeFileName,
            cryptoKey: s.cryptoKey,
            salt: s.salt,
          };
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
          await enqueuePersistVaultSnapshot(() => {
            const s = useSessionStore.getState();
            return {
              activeFileName: s.activeFileName,
              cryptoKey: s.cryptoKey,
              salt: s.salt,
            };
          });
        }
      },

      deleteTemplate: async (id) => {
        await templateTable.delete(id);
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));

        await enqueuePersistVaultSnapshot(() => {
          const s = useSessionStore.getState();
          return {
            activeFileName: s.activeFileName,
            cryptoKey: s.cryptoKey,
            salt: s.salt,
          };
        });
      },

      clearTemplates: async () => {
        await templateTable.clear();
        set({ templates: [], initialized: false });

        await enqueuePersistVaultSnapshot(() => {
          const s = useSessionStore.getState();
          return {
            activeFileName: s.activeFileName,
            cryptoKey: s.cryptoKey,
            salt: s.salt,
          };
        });
      },

      getTemplate: (id) => get().templates.find((t) => t.id === id),
    }),
    { name: "TemplateStore" },
  ),
);

// Dev/테스트 환경에서 Zustand store 디버그용 노출
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__KIYO_DEBUG__ = {
    ...((window as unknown as Record<string, unknown>).__KIYO_DEBUG__ ?? {}),
    getTemplateStore: () => {
      const state = useTemplateStore.getState();
      return {
        templatesCount: state.templates.length,
        initialized: state.initialized,
        isLoading: state.isLoading,
      };
    },
  };
}