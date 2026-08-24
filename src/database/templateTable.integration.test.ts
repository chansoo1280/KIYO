import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import Dexie from "dexie";
import { templateTable } from "@/database/templateTable";
import { createCryptoKey } from "@/crypto/encryption";
import { getDatabase } from "@/database/db";
import { createTestTemplates } from "@/test/fixtures/templateFixtures";
import { useSessionStore } from "@/store/sessionStore";
import type { Template } from "@/models/template";

// Use real IndexedDB via Dexie (works in Vitest with jsdom)
describe("templateTable - 템플릿 암호화 CRUD", () => {
  beforeAll(async () => {
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore
    }
  });

  const resetTestEnvironment = async () => {
    const db = getDatabase();
    await db.templates.clear();
    await db.accounts.clear();
    await db.settings.clear();
    await db.metadata.clear();
    await db.files.clear();
    await useSessionStore.getState().clearSession();
  };

  beforeEach(async () => {
    await resetTestEnvironment();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetTestEnvironment();
    vi.clearAllMocks();
  });

  let testKey: CryptoKey;

  beforeEach(async () => {
    const result = await createCryptoKey("test-pin-1234");
    testKey = result.key;
  });

  describe("create → getAll → getById (평문)", () => {
    it("평문 템플릿을 생성하고 조회한다", async () => {
          const testTemplate: Omit<Template, "id" | "createdAt" | "updatedAt"> = createTestTemplates(1)[0];

          const created = await templateTable.create(testTemplate);

      expect(created.id).toBeDefined();
      expect(created.name).toBe(testTemplate.name);
      expect(created.fields).toEqual(testTemplate.fields);
      expect(created.sortOrder).toBe(testTemplate.sortOrder);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();

      // getAll로 조회
      const all = await templateTable.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe(testTemplate.name);
      expect(all[0].fields).toEqual(testTemplate.fields);

      // getById로 조회
      const byId = await templateTable.getById(created.id);
      expect(byId).toBeDefined();
      expect(byId!.name).toBe(testTemplate.name);
    });

    it("getAll은 sortOrder 순으로 정렬된다", async () => {
          const templates = createTestTemplates(3);
          for (const template of templates) {
            await templateTable.create(template);
          }

      const all = await templateTable.getAll();
      expect(all).toHaveLength(3);
      // sortOrder 순 정렬 확인
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].sortOrder).toBeLessThanOrEqual(all[i].sortOrder);
      }
    });
  });

  describe("create → getAll → getById (암호화)", () => {
    it("암호화된 템플릿을 생성하고 키로 복호화 조회한다", async () => {
      const testTemplate = createTestTemplates(1)[0];

      const created = await templateTable.create(testTemplate, testKey);

      expect(created.id).toBeDefined();
      expect(created.name).toBe(testTemplate.name);

      // 키 없이 조회하면 에러 던짐 (templateTable은 throw)
      await expect(templateTable.getAll()).rejects.toThrow("CryptoKey is required");

      // 키로 조회하면 정상 복호화
      const withKey = await templateTable.getAll(testKey);
      expect(withKey).toHaveLength(1);
      expect(withKey[0].name).toBe(testTemplate.name);
      expect(withKey[0].fields).toEqual(testTemplate.fields);
      expect(withKey[0].sortOrder).toBe(testTemplate.sortOrder);

      // getById도 동일
      const byId = await templateTable.getById(created.id, testKey);
      expect(byId).toBeDefined();
      expect(byId!.name).toBe(testTemplate.name);
      expect(byId!.fields).toEqual(testTemplate.fields);
    });

    it("잘못된 키로 복호화 시도 시 에러 던짐", async () => {
          const testTemplate = createTestTemplates(1)[0];
          await templateTable.create(testTemplate, testKey);

      const wrongKeyResult = await createCryptoKey("wrong-pin");
      await expect(templateTable.getAll(wrongKeyResult.key)).rejects.toThrow();
    });

    it("키 없이 getById 호출 시 undefined 반환", async () => {
      const testTemplate = createTestTemplates(1)[0];
      const created = await templateTable.create(testTemplate, testKey);

      const withoutKey = await templateTable.getById(created.id);
      expect(withoutKey).toBeUndefined();
    });
  });

  describe("update", () => {
    it("평문 템플릿을 수정한다", async () => {
      const testTemplate = createTestTemplates(1)[0];
      const created = await templateTable.create(testTemplate);

      // 수정
      const updatedTemplate: Template = {
        ...created,
        name: "Updated Template",
        fields: [{ id: "f1", label: "New Field", type: "text", defaultValue: "", order: 0, options: [] }],
        sortOrder: 5,
      };
      await templateTable.update(updatedTemplate);

      const retrieved = await templateTable.getById(created.id);
      expect(retrieved!.name).toBe("Updated Template");
      expect(retrieved!.fields).toHaveLength(1);
      expect(retrieved!.fields[0].label).toBe("New Field");
      expect(retrieved!.sortOrder).toBe(5);
      // createdAt 보존
      expect(retrieved!.createdAt).toBe(created.createdAt);
      // updatedAt 갱신
      expect(retrieved!.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it("암호화 템플릿을 수정한다 (키 필요)", async () => {
      const testTemplate = createTestTemplates(1)[0];
      const created = await templateTable.create(testTemplate, testKey);

      const updatedTemplate: Template = {
        ...created,
        name: "Updated Encrypted",
        updatedAt: Date.now(),
      };
      await templateTable.update(updatedTemplate, testKey);

      const retrieved = await templateTable.getById(created.id, testKey);
      expect(retrieved!.name).toBe("Updated Encrypted");
      expect(retrieved!.createdAt).toBe(created.createdAt);
    });

    it("존재하지 않는 템플릿 수정 시 에러 없이 무시", async () => {
      const nonExistent: Template = {
        id: "non-existent",
        name: "Non Existent",
        description: "",
        icon: "📋",
        sortOrder: 0,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await expect(templateTable.update(nonExistent, testKey)).resolves.not.toThrow();
    });
  });

  describe("delete", () => {
    it("템플릿을 삭제한다", async () => {
      const testTemplate = createTestTemplates(1)[0];
      const created = await templateTable.create(testTemplate, testKey);

      expect(await templateTable.getById(created.id, testKey)).toBeDefined();

      await templateTable.delete(created.id);

      expect(await templateTable.getById(created.id, testKey)).toBeUndefined();
      expect(await templateTable.getAll(testKey)).toHaveLength(0);
    });

    it("존재하지 않는 ID 삭제 시 에러 없음", async () => {
      await expect(templateTable.delete("non-existent")).resolves.not.toThrow();
    });
  });

  describe("clear", () => {
    it("모든 템플릿을 삭제한다", async () => {
      const templates = createTestTemplates(3);
      for (const template of templates) {
        await templateTable.create(template, testKey);
      }

      expect(await templateTable.getAll(testKey)).toHaveLength(3);

      await templateTable.clear();

      expect(await templateTable.getAll(testKey)).toHaveLength(0);
    });
  });

  describe("경계값/복잡한 구조", () => {
    it("복잡한 필드 구조도 암호화/복호화 정상 동작", async () => {
      const complexTemplate: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
        name: "Complex Template",
        description: "템플릿 설명",
        icon: "🔐",
        sortOrder: 0,
        fields: [
          { id: "f1", label: "Username", type: "text", defaultValue: "user@example.com", order: 0, options: [] },
          { id: "f2", label: "Password", type: "password", defaultValue: "p@ssw0rd!", order: 1, options: [] },
          { id: "f3", label: "TOTP Secret", type: "totp", defaultValue: "JBSWY3DPEHPK3PXP", order: 2, options: [] },
          { id: "f4", label: "Custom Select", type: "select", defaultValue: "option1", order: 3, options: ["option1", "option2", "option3"] },
          { id: "f5", label: "Notes", type: "textarea", defaultValue: "특수문자: \"'\\<>? 한글 日本語 🎉", order: 4, options: [] },
        ],
      };

      const created = await templateTable.create(complexTemplate, testKey);
      const retrieved = await templateTable.getById(created.id, testKey);

      expect(retrieved).toBeDefined();
      expect(retrieved!.fields).toHaveLength(5);
      expect(retrieved!.fields[0].defaultValue).toBe("user@example.com");
      expect(retrieved!.fields[1].defaultValue).toBe("p@ssw0rd!");
      expect(retrieved!.fields[2].type).toBe("totp");
      expect(retrieved!.fields[3].options).toEqual(["option1", "option2", "option3"]);
      expect(retrieved!.fields[4].defaultValue).toBe("특수문자: \"'\\<>? 한글 日本語 🎉");
    });

    it("DB에 저장된 암호화 레코드 직접 조회 시 구조 확인", async () => {
      const testTemplate = createTestTemplates(1)[0];
      const created = await templateTable.create(testTemplate, testKey);

      const db = getDatabase();
      const rawRecord = await db.templates.get(created.id);

      expect(rawRecord).toBeDefined();
      expect(rawRecord!.encrypted).toBe(true);
      expect(rawRecord!.encryptedData).toBeDefined();
      expect(rawRecord!.iv).toBeDefined();
      expect(() => new Uint8Array(rawRecord!.encryptedData)).not.toThrow();
      expect(() => new Uint8Array(rawRecord!.iv)).not.toThrow();
      expect(new Uint8Array(rawRecord!.iv).length).toBe(12);
      expect(rawRecord!.algorithm).toBe("AES-GCM");
      expect(rawRecord!.version).toBe(1);
      expect(typeof rawRecord!.createdAt).toBe("number");
      expect(typeof rawRecord!.updatedAt).toBe("number");
    });
  });
});