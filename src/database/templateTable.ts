import { db } from "./db";
import type { Template } from "../models/template";
import { BUILTIN_TEMPLATES } from "../data/builtinTemplates";

export const templateTable = {
  async init(): Promise<void> {
    const count = await db.templates.count();
    if (count === 0) {
      // DB가 비어있으면 내장 템플릿 시드
      for (const builtin of BUILTIN_TEMPLATES) {
        await templateTable.create(builtin);
      }
    }
  },

  async getAll(): Promise<Template[]> {
    return db.templates.orderBy("sortOrder").toArray();
  },

  async getById(id: string): Promise<Template | undefined> {
    return db.templates.get(id);
  },

  async create(template: Omit<Template, "id" | "createdAt" | "updatedAt">): Promise<Template> {
    const now = Date.now();
    const newTemplate: Template = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.templates.add(newTemplate);
    return newTemplate;
  },

  async update(id: string, patch: Partial<Template>): Promise<void> {
    await db.templates.update(id, {
      ...patch,
      updatedAt: Date.now(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.templates.delete(id);
  },

  async reorder(ids: string[]): Promise<void> {
    await db.transaction("rw", db.templates, async () => {
      // 전달된 ID들에 대해 순차적으로 sortOrder 부여
      for (let i = 0; i < ids.length; i++) {
        await db.templates.update(ids[i], { sortOrder: i, updatedAt: Date.now() });
      }

      // 전달되지 않은 나머지 템플릿들은 전달된 ID들 뒤에 순서대로 배치
      // 현재 DB의 모든 템플릿 중 ids에 없는 것들을 가져와서 sortOrder 재할당
      const allTemplates = await db.templates.toArray();
      const remainingTemplates = allTemplates.filter((t) => !ids.includes(t.id));
      // 기존 sortOrder 순서 유지하며 뒤에 배치
      remainingTemplates.sort((a, b) => a.sortOrder - b.sortOrder);
      for (let i = 0; i < remainingTemplates.length; i++) {
        await db.templates.update(remainingTemplates[i].id, {
          sortOrder: ids.length + i,
          updatedAt: Date.now(),
        });
      }
    });
  },
};