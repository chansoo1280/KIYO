import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { templateTable } from "@/database/templateTable";
import { getDatabase } from "@/database/db";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import * as dbModule from "@/database/db";
import { fileTable } from "@/database/fileTable";
import type { Template } from "@/models/template";

// Mock Capacitor - web platform
vi.mock("@capacitor/core", () => ({
  registerPlugin: vi.fn(() => ({
    isAutofillEnabled: vi
      .fn()
      .mockResolvedValue({
        enabled: false,
        hasService: false,
        servicePackageName: null,
      }),
    getAutofillServiceInfo: vi
      .fn()
      .mockResolvedValue({
        isEnabled: false,
        isOurService: false,
        servicePackageName: null,
      }),
    requestAutofillEnable: vi.fn().mockResolvedValue(undefined),
    getAccountCount: vi.fn().mockResolvedValue({ count: 0 }),
    syncAccountsFromReact: vi
      .fn()
      .mockResolvedValue({ success: true, syncedCount: 0, errorCount: 0 }),
    syncAccounts: vi
      .fn()
      .mockResolvedValue({ syncedCount: 0, errorCount: 0, totalProcessed: 0 }),
    getAccounts: vi.fn().mockResolvedValue({ accounts: [], count: 0 }),
    addAccount: vi.fn().mockResolvedValue({ id: 1, success: true }),
    updateAccount: vi.fn().mockResolvedValue({ updated: true, id: 1 }),
    deleteAccount: vi.fn().mockResolvedValue({ deleted: true, id: 1 }),
    toggleFavorite: vi.fn().mockResolvedValue({ success: true, id: 1 }),
    clearAllAccounts: vi
      .fn()
      .mockResolvedValue({ deletedCount: 0, success: true }),
  })),
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
    getPlatform: vi.fn(() => "web"),
  },
}));

// Mock Filesystem for web platform
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error("File not found")),
  },
  Directory: {
    Documents: "DOCUMENTS",
  },
  Encoding: {
    UTF8: "utf8",
  },
}));

// Mock KiyoAutofill plugin
vi.mock("@/plugins/kiyautofill", () => ({
  KiyoAutofill: {
    saveSession: vi.fn().mockResolvedValue(undefined),
    clearSession: vi.fn().mockResolvedValue(undefined),
    hasSession: vi.fn().mockResolvedValue({ hasSession: false }),
  },
}));

// Use real IndexedDB via Dexie (works in Vitest with jsdom)

describe("templateTable Integration Tests", () => {
  let testDbName: string;

  beforeAll(async () => {
    // Use a unique test database name to avoid conflicts
    testDbName = `kiyo-test-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // We need to use a fresh database for each test run
    // Since Dexie uses IndexedDB, we'll use the real implementation
  });

  afterAll(async () => {
    // Clean up test database
    try {
      await indexedDB.deleteDatabase(testDbName);
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper to fully reset database and stores
  const resetTestEnvironment = async () => {
    const db = getDatabase();
    await db.templates.clear();
    await fileTable.clearActiveFileInfo();
    await useSessionStore.getState().clearSession();
    await useAccountStore.getState().setAccounts([]);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTestEnvironment();
    vi.spyOn(dbModule, "initializeDatabase").mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.resetAllMocks();
    await resetTestEnvironment();
  });

  // Helper to create a valid Template input
  const createTemplateInput = (overrides: Partial<Template> = {}): Omit<Template, "id" | "createdAt" | "updatedAt"> => ({
    name: "Test Template",
    description: "Test Description",
    icon: "📋",
    sortOrder: 0,
    fields: [
      { label: "Username", type: "text" as const, placeholder: "", defaultValue: "", options: [] },
      { label: "Password", type: "password" as const, placeholder: "", defaultValue: "", options: [] },
    ],
    ...overrides,
  });


  describe("init", () => {
    it("빈 DB에 내장 템플릿을 시드한다", async () => {
      const db = getDatabase();
      const countBefore = await db.templates.count();
      expect(countBefore).toBe(0);

      await templateTable.init();

      const countAfter = await db.templates.count();
      expect(countAfter).toBeGreaterThan(0);

      const templates = await templateTable.getAll();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty("id");
      expect(templates[0]).toHaveProperty("name");
      expect(templates[0]).toHaveProperty("sortOrder");
    });

    it("이미 데이터가 있으면 시드하지 않는다", async () => {
      const db = getDatabase();
      await templateTable.init();
      const countAfterInit = await db.templates.count();

      // 두 번째 init 호출
      await templateTable.init();
      const countAfterSecondInit = await db.templates.count();

      expect(countAfterSecondInit).toBe(countAfterInit);
    });
  });

  describe("getAll", () => {
    it("sortOrder 순서로 모든 템플릿을 반환한다", async () => {
      // init() 없이 빈 DB에서 시작
      await templateTable.create(createTemplateInput({ name: "C", sortOrder: 2 }));
      await templateTable.create(createTemplateInput({ name: "A", sortOrder: 0 }));
      await templateTable.create(createTemplateInput({ name: "B", sortOrder: 1 }));

      const result = await templateTable.getAll();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("A");
      expect(result[0].sortOrder).toBe(0);
      expect(result[1].name).toBe("B");
      expect(result[1].sortOrder).toBe(1);
      expect(result[2].name).toBe("C");
      expect(result[2].sortOrder).toBe(2);
    });

    it("빈 DB에서는 빈 배열을 반환한다", async () => {
      // init 호출 안 함 - 빈 DB 상태
      const result = await templateTable.getAll();
      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("ID로 템플릿을 조회한다", async () => {
      await templateTable.init();
      const created = await templateTable.create(createTemplateInput({ name: "조회 테스트" }));

      const result = await templateTable.getById(created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
      expect(result!.name).toBe("조회 테스트");
      expect(result!.createdAt).toBe(created.createdAt);
      expect(result!.updatedAt).toBe(created.updatedAt);
    });

    it("존재하지 않으면 undefined를 반환한다", async () => {
      await templateTable.init();

      const result = await templateTable.getById("nonexistent-id");

      expect(result).toBeUndefined();
    });
  });

  describe("create", () => {
    it("UUID, 타임스탬프를 생성하여 템플릿을 저장한다", async () => {
      await templateTable.init();
      const input = createTemplateInput({ name: "새 템플릿", sortOrder: 5 });

      const result = await templateTable.create(input);

      expect(result).toMatchObject(input);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.createdAt).toBe(result.updatedAt);

      // DB에 실제로 저장되었는지 확인
      const db = getDatabase();
      const stored = await db.templates.get(result.id);
      expect(stored).toBeDefined();
      expect(stored!.name).toBe("새 템플릿");
      expect(stored!.sortOrder).toBe(5);
    });

    it("여러 템플릿 생성 시 각각 고유한 ID를 가진다", async () => {
      await templateTable.init();

      const t1 = await templateTable.create(createTemplateInput({ name: "템플릿 1" }));
      const t2 = await templateTable.create(createTemplateInput({ name: "템플릿 2" }));
      const t3 = await templateTable.create(createTemplateInput({ name: "템플릿 3" }));

      expect(t1.id).not.toBe(t2.id);
      expect(t2.id).not.toBe(t3.id);
      expect(t1.id).not.toBe(t3.id);
    });

    it("필드 배열이 정확히 저장된다", async () => {
      await templateTable.init();
      const customFields = [
        { label: "이메일", type: "email" as const, placeholder: "test@example.com", defaultValue: "", options: [] },
        { label: "OTP", type: "totp" as const, placeholder: "123456", defaultValue: "", options: [] },
      ];

      const result = await templateTable.create(createTemplateInput({ fields: customFields }));

      expect(result.fields).toEqual(customFields);

      const db = getDatabase();
      const stored = await db.templates.get(result.id);
      expect(stored!.fields).toEqual(customFields);
    });
  });

  describe("update", () => {
    it("템플릿을 수정하고 updatedAt을 갱신한다", async () => {
      await templateTable.init();
      const created = await templateTable.create(createTemplateInput({ name: "원본" }));
      const originalUpdatedAt = created.updatedAt;

      // 약간의 시간 차이를 두기 위해 대기
      await new Promise((resolve) => setTimeout(resolve, 10));

      await templateTable.update(created.id, { name: "수정된 이름", description: "새 설명" });

      const result = await templateTable.getById(created.id);
      expect(result).toBeDefined();
      expect(result!.name).toBe("수정된 이름");
      expect(result!.description).toBe("새 설명");
      expect(result!.updatedAt).toBeGreaterThan(originalUpdatedAt);
      expect(result!.createdAt).toBe(created.createdAt); // createdAt은 변경되지 않음
    });

    it("존재하지 않는 ID로 업데이트해도 에러 없이 통과한다 (Dexie 특성)", async () => {
      await templateTable.init();

      // Dexie의 update는 존재하지 않는 키여도 에러를 던지지 않음
      await expect(
        templateTable.update("nonexistent-id", { name: "테스트" }),
      ).resolves.not.toThrow();
    });

    it("필드만 부분 업데이트한다", async () => {
      await templateTable.init();
      const created = await templateTable.create(createTemplateInput());

      await templateTable.update(created.id, {
        fields: [
          { label: "새 필드", type: "text", placeholder: "", defaultValue: "", options: [] },
        ],
      });

      const result = await templateTable.getById(created.id);
      expect(result!.fields).toHaveLength(1);
      expect(result!.fields[0].label).toBe("새 필드");
    });
  });

  describe("delete", () => {
    it("템플릿을 삭제한다", async () => {
      // init() 없이 빈 DB에서 시작
      const created = await templateTable.create(createTemplateInput({ name: "삭제할 템플릿" }));

      await templateTable.delete(created.id);

      const result = await templateTable.getById(created.id);
      expect(result).toBeUndefined();

      const db = getDatabase();
      const count = await db.templates.count();
      expect(count).toBe(0);
    });

    it("여러 템플릿 중 하나만 삭제한다", async () => {
      // init() 없이 빈 DB에서 시작
      const t1 = await templateTable.create(createTemplateInput({ name: "템플릿 1" }));
      const t2 = await templateTable.create(createTemplateInput({ name: "템플릿 2" }));
      const t3 = await templateTable.create(createTemplateInput({ name: "템플릿 3" }));

      await templateTable.delete(t2.id);

      const remaining = await templateTable.getAll();
      expect(remaining).toHaveLength(2);
      expect(remaining.find((t) => t.id === t1.id)).toBeDefined();
      expect(remaining.find((t) => t.id === t3.id)).toBeDefined();
      expect(remaining.find((t) => t.id === t2.id)).toBeUndefined();
    });
  });

  describe("reorder", () => {
    it("트랜잭션 내에서 순서대로 sortOrder를 업데이트한다", async () => {
      // init() 없이 빈 DB에서 시작 (내장 템플릿 시드 방지)
      const t1 = await templateTable.create(createTemplateInput({ name: "첫 번째", sortOrder: 0 }));
      const t2 = await templateTable.create(createTemplateInput({ name: "두 번째", sortOrder: 1 }));
      const t3 = await templateTable.create(createTemplateInput({ name: "세 번째", sortOrder: 2 }));

      // 순서 변경: t3, t1, t2
      await templateTable.reorder([t3.id, t1.id, t2.id]);

      const result = await templateTable.getAll();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(t3.id);
      expect(result[0].sortOrder).toBe(0);
      expect(result[1].id).toBe(t1.id);
      expect(result[1].sortOrder).toBe(1);
      expect(result[2].id).toBe(t2.id);
      expect(result[2].sortOrder).toBe(2);

      // 모든 템플릿의 updatedAt이 갱신되었는지 확인
      expect(result[0].updatedAt).toBeGreaterThanOrEqual(t3.updatedAt);
      expect(result[1].updatedAt).toBeGreaterThanOrEqual(t1.updatedAt);
      expect(result[2].updatedAt).toBeGreaterThanOrEqual(t2.updatedAt);
    });

    it("빈 배열로 호출해도 에러 없이 통과한다", async () => {
      // init() 없이 빈 DB에서 시작
      await expect(templateTable.reorder([])).resolves.not.toThrow();

      const result = await templateTable.getAll();
      expect(result).toEqual([]);
    });

    it("일부 ID만 전달해도 해당 ID들만 재정렬한다", async () => {
      // init() 없이 빈 DB에서 시작
      const t1 = await templateTable.create(createTemplateInput({ name: "A", sortOrder: 0 }));
      const t2 = await templateTable.create(createTemplateInput({ name: "B", sortOrder: 1 }));
      const t3 = await templateTable.create(createTemplateInput({ name: "C", sortOrder: 2 }));

      // t1과 t3만 순서 바꾸기 (t2는 건드리지 않음)
      await templateTable.reorder([t3.id, t1.id]);

      const result = await templateTable.getAll();
      // t3가 0, t1이 1, t2는 그대로 2여야 함 (재정렬되지 않음)
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(t3.id);
      expect(result[0].sortOrder).toBe(0);
      expect(result[1].id).toBe(t1.id);
      expect(result[1].sortOrder).toBe(1);
      expect(result[2].id).toBe(t2.id);
      expect(result[2].sortOrder).toBe(2);
    });
  });

  describe("통합 시나리오", () => {
    it("init -> create -> getAll -> update -> delete -> reorder 전체 흐름", async () => {
      // 1. 초기화
      await templateTable.init();
      const initialCount = (await templateTable.getAll()).length;
      expect(initialCount).toBeGreaterThan(0); // 내장 템플릿 시드됨

      // 2. 사용자 템플릿 생성
      const userTemplate = await templateTable.create(
        createTemplateInput({ name: "내 템플릿", sortOrder: 10 }),
      );

      // 3. 전체 조회 (내장 템플릿 + 사용자 템플릿)
      let all = await templateTable.getAll();
      expect(all.length).toBe(initialCount + 1);
      expect(all.find((t) => t.id === userTemplate.id)).toBeDefined();

      // 4. 수정
      await templateTable.update(userTemplate.id, {
        name: "수정된 내 템플릿",
        sortOrder: 0,
      });

      // 5. 재정렬 (사용자 템플릿을 맨 위로)
      const allIds = all.map((t) => t.id);
      // 사용자 템플릿 ID를 맨 앞으로
      const reorderedIds = [userTemplate.id, ...allIds.filter((id) => id !== userTemplate.id)];
      await templateTable.reorder(reorderedIds);

      all = await templateTable.getAll();
      expect(all[0].id).toBe(userTemplate.id);
      expect(all[0].name).toBe("수정된 내 템플릿");

      // 6. 삭제
      await templateTable.delete(userTemplate.id);

      all = await templateTable.getAll();
      expect(all.length).toBe(initialCount);
      expect(all.find((t) => t.id === userTemplate.id)).toBeUndefined();
    });

    it("내장 템플릿 사이에 사용자 템플릿을 끼워넣을 수 있다", async () => {
      await templateTable.init();

      const builtin = await templateTable.getAll();
      const builtinCount = builtin.length;

      // 내장 템플릿 중간에 끼워넣을 sortOrder 계산 (3번째와 4번째 사이: sortOrder 2.5 불가하므로 정수로 조정 후 재정렬)
      const insertIndex = Math.floor(builtinCount / 2); // 3 (0,1,2 | 3,4,5)

      // 사용자 템플릿 생성 (임시 sortOrder, 나중에 재정렬)
      const userTemplate = await templateTable.create(
        createTemplateInput({ name: "중간 삽입", sortOrder: insertIndex + 10 }),
      );

      // 재정렬: 내장 템플릿의 insertIndex 이후 것들을 한 칸씩 뒤로 밀고 사용자 템플릿을 insertIndex에 배치
      const all = await templateTable.getAll();
      const ids = all.map((t) => t.id);
      // userTemplate을 insertIndex 위치로 이동
      const userIdx = ids.indexOf(userTemplate.id);
      ids.splice(userIdx, 1);
      ids.splice(insertIndex, 0, userTemplate.id);
      await templateTable.reorder(ids);

      const reordered = await templateTable.getAll();
      expect(reordered.length).toBe(builtinCount + 1);

      // 정렬 순서 확인
      const userIndex = reordered.findIndex((t) => t.id === userTemplate.id);
      expect(userIndex).toBe(insertIndex);
      expect(reordered[userIndex].sortOrder).toBe(insertIndex);
    });
  });

  describe("데이터 무결성", () => {
    it("createdAt은 생성 후 변경되지 않는다", async () => {
      await templateTable.init();
      const created = await templateTable.create(createTemplateInput());

      await new Promise((resolve) => setTimeout(resolve, 10));
      await templateTable.update(created.id, { name: "변경됨" });

      const result = await templateTable.getById(created.id);
      expect(result!.createdAt).toBe(created.createdAt);
      expect(result!.updatedAt).toBeGreaterThan(created.createdAt);
    });

    it("동시 생성 시 ID 충돌이 없다", async () => {
      await templateTable.init();

      const promises = Array.from({ length: 10 }, (_, i) =>
        templateTable.create(createTemplateInput({ name: `동시 ${i}` })),
      );

      const results = await Promise.all(promises);
      const ids = results.map((r) => r.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10); // 모두 고유함
    });

    it("특수 문자가 포함된 이름/설명도 정상 저장된다", async () => {
      await templateTable.init();

      const specialChars = "한글 <script>alert(1)</script> \"따옴표\" '작은따옴표' 🎉 이모지";
      const created = await templateTable.create(
        createTemplateInput({ name: specialChars, description: specialChars }),
      );

      const result = await templateTable.getById(created.id);
      expect(result!.name).toBe(specialChars);
      expect(result!.description).toBe(specialChars);
    });
  });
});