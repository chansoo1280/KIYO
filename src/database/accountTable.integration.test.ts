import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import Dexie from "dexie";
import { accountTable } from "@/database/accountTable";
import { createCryptoKey } from "@/crypto/encryption";
import { getDatabase } from "@/database/db";
import { createTestAccounts } from "@/test/fixtures/accountFixtures";
import { useSessionStore } from "@/store/sessionStore";
import type { Account } from "@/models/account";

// Use real IndexedDB via Dexie (works in Vitest with jsdom)
describe("accountTable - 계정 암호화 CRUD", () => {
  beforeAll(async () => {
    // Clean up test database
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await Dexie.delete("kiyo-db");
    } catch {
      // Ignore
    }
  });

  const resetTestEnvironment = async () => {
    const db = getDatabase();
    await db.accounts.clear();
    await db.templates.clear();
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
    it("평문 계정을 생성하고 조회한다", async () => {
      const testAccount = createTestAccounts(1)[0];

      const created = await accountTable.create(testAccount);

      expect(created.id).toBeGreaterThan(0);
      expect(created.title).toBe(testAccount.title);
      expect(created.fields).toEqual(testAccount.fields);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();

      // getAll로 조회 - 평문은 id가 encryptedData에 포함되지 않으므로 title/fields로 확인
      const all = await accountTable.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe(testAccount.title);
      expect(all[0].fields).toEqual(testAccount.fields);

      // getById로 조회
      const byId = await accountTable.getById(created.id);
      expect(byId).toBeDefined();
      expect(byId!.title).toBe(testAccount.title);
    });

    it("여러 계정 생성 시 updatedAt 역순으로 정렬된다", async () => {
      const accounts = createTestAccounts(3);
      for (const account of accounts) {
        await accountTable.create(account);
        // 약간의 시간 간격
        await new Promise((r) => setTimeout(r, 5));
      }

      const all = await accountTable.getAll();
      expect(all).toHaveLength(3);
      // updatedAt 역순 정렬 확인
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].updatedAt).toBeGreaterThanOrEqual(all[i].updatedAt);
      }
    });
  });

  describe("create → getAll → getById (암호화)", () => {
    it("암호화된 계정을 생성하고 키로 복호화 조회한다", async () => {
      const testAccount = createTestAccounts(1)[0];

      const created = await accountTable.create(testAccount, testKey);

      expect(created.id).toBeGreaterThan(0);
      expect(created.title).toBe(testAccount.title);

      // 키 없이 조회하면 최소 정보만 반환 (복호화 실패)
      const withoutKey = await accountTable.getAll();
      expect(withoutKey).toHaveLength(1);
      expect(withoutKey[0].title).toBe(""); // 복호화 실패 시 빈 문자열
      expect(withoutKey[0].fields).toEqual([]);

      // 키로 조회하면 정상 복호화
      const withKey = await accountTable.getAll(testKey);
      expect(withKey).toHaveLength(1);
      expect(withKey[0].title).toBe(testAccount.title);
      expect(withKey[0].fields).toEqual(testAccount.fields);
      expect(withKey[0].websiteUrl).toBe(testAccount.websiteUrl);
      expect(withKey[0].domain).toBe(testAccount.domain);

      // getById도 동일
      const byId = await accountTable.getById(created.id, testKey);
      expect(byId).toBeDefined();
      expect(byId!.title).toBe(testAccount.title);
      expect(byId!.fields).toEqual(testAccount.fields);
    });

    it("잘못된 키로 복호화 시도 시 최소 정보 반환 (에러 던지지 않음)", async () => {
      const testAccount = createTestAccounts(1)[0];
      await accountTable.create(testAccount, testKey);

      const wrongKeyResult = await createCryptoKey("wrong-pin");
      const withWrongKey = await accountTable.getAll(wrongKeyResult.key);

      expect(withWrongKey).toHaveLength(1);
      // 복호화 실패 시 빈 필드 반환하지만 에러는 던지지 않음
      expect(withWrongKey[0].title).toBe("");
      expect(withWrongKey[0].fields).toEqual([]);
    });
  });

  describe("update", () => {
    it("평문 계정을 수정한다", async () => {
      const testAccount = createTestAccounts(1)[0];
      const created = await accountTable.create(testAccount);

      // 수정
      const updatedAccount: Account = {
        ...created,
        title: "Updated Title",
        tags: ["updated"],
        fields: [{ id: "f1", label: "New Field", type: "text", value: "new value", order: 0 }],
      };
      await accountTable.update(updatedAccount);

      const retrieved = await accountTable.getById(created.id);
      expect(retrieved!.title).toBe("Updated Title");
      expect(retrieved!.tags).toEqual(["updated"]);
      expect(retrieved!.fields).toHaveLength(1);
      expect(retrieved!.fields[0].value).toBe("new value");
      // createdAt 보존
      expect(retrieved!.createdAt).toBe(created.createdAt);
      // updatedAt 갱신
      expect(retrieved!.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it("암호화 계정을 수정한다 (키 필요)", async () => {
      const testAccount = createTestAccounts(1)[0];
      const created = await accountTable.create(testAccount, testKey);

      // 키 없이 수정 시도 - 에러가 나거나 무시됨 (현재 구현은 암호화된 상태로 저장 시도)
      const updatedAccount: Account = {
        ...created,
        title: "Updated Encrypted",
        updatedAt: Date.now(),
      };
      await accountTable.update(updatedAccount, testKey);

      const retrieved = await accountTable.getById(created.id, testKey);
      expect(retrieved!.title).toBe("Updated Encrypted");
      expect(retrieved!.createdAt).toBe(created.createdAt);
    });

    it("존재하지 않는 계정 수정 시 에러 없이 무시", async () => {
      const nonExistent: Account = {
        id: 999,
        templateId: "1",
        title: "Non Existent",
        tags: [],
        favorite: false,
        fields: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await expect(accountTable.update(nonExistent, testKey)).resolves.not.toThrow();
    });
  });

  describe("delete", () => {
    it("계정을 삭제한다", async () => {
      const testAccount = createTestAccounts(1)[0];
      const created = await accountTable.create(testAccount, testKey);

      expect(await accountTable.getById(created.id, testKey)).toBeDefined();

      await accountTable.delete(created.id);

      expect(await accountTable.getById(created.id, testKey)).toBeUndefined();
      expect(await accountTable.getAll(testKey)).toHaveLength(0);
    });

    it("존재하지 않는 ID 삭제 시 에러 없음", async () => {
      await expect(accountTable.delete(999)).resolves.not.toThrow();
    });
  });

  describe("clear", () => {
    it("모든 계정을 삭제한다", async () => {
      const accounts = createTestAccounts(3);
      for (const account of accounts) {
        await accountTable.create(account, testKey);
      }

      expect(await accountTable.getAll(testKey)).toHaveLength(3);

      await accountTable.clear();

      expect(await accountTable.getAll(testKey)).toHaveLength(0);
    });
  });

  describe("restore / bulkRestore (백업/복원용)", () => {
    it("특정 ID로 계정을 복원한다 (평문)", async () => {
      const originalAccount = createTestAccounts(1)[0];
      // ID를 지정하여 복원
      const accountToRestore: Account = {
        ...originalAccount,
        id: 42,
        title: "Restored Account",
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 50000,
      };

      const restored = await accountTable.restore(accountToRestore);

      expect(restored.id).toBe(42);
      expect(restored.title).toBe("Restored Account");

      const retrieved = await accountTable.getById(42);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(42);
      expect(retrieved!.title).toBe("Restored Account");
      // createdAt 보존 확인
      expect(retrieved!.createdAt).toBe(accountToRestore.createdAt);
    });

    it("특정 ID로 계정을 복원한다 (암호화)", async () => {
      const originalAccount = createTestAccounts(1)[0];
      const accountToRestore: Account = {
        ...originalAccount,
        id: 99,
        title: "Encrypted Restored",
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 50000,
      };

      await accountTable.restore(accountToRestore, testKey);

      const retrieved = await accountTable.getById(99, testKey);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(99);
      expect(retrieved!.title).toBe("Encrypted Restored");
      expect(retrieved!.fields).toEqual(originalAccount.fields);
    });

    it("bulkRestore로 여러 계정을 한 번에 복원한다 (암호화)", async () => {
      const accounts = createTestAccounts(3);
      const accountsToRestore = accounts.map((a, i) => ({
        ...a,
        id: 100 + i,
        title: `Bulk ${i + 1}`,
        createdAt: Date.now() - 100000,
        updatedAt: Date.now() - 50000,
      }));

      await accountTable.bulkRestore(accountsToRestore, testKey);

      const all = await accountTable.getAll(testKey);
      expect(all).toHaveLength(3);

      for (let i = 0; i < 3; i++) {
        const retrieved = await accountTable.getById(100 + i, testKey);
        expect(retrieved).toBeDefined();
        expect(retrieved!.id).toBe(100 + i);
        expect(retrieved!.title).toBe(`Bulk ${i + 1}`);
      }
    });

    it("bulkRestore 평문도 동작한다", async () => {
      const accounts = createTestAccounts(2);
      const accountsToRestore = accounts.map((a, i) => ({
        ...a,
        id: 200 + i,
        title: `Plain Bulk ${i + 1}`,
      }));

      await accountTable.bulkRestore(accountsToRestore);

      const all = await accountTable.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe("초기화/경계값", () => {
    it("이미 데이터가 있으면 initializeDevData는 아무것도 하지 않는다", async () => {
      // 먼저 데이터 생성
      const testAccount = createTestAccounts(1)[0];
      await accountTable.create(testAccount);

      // dev 데이터로 초기화 시도 (기존 데이터 1개 있음)
      const devAccounts = createTestAccounts(5);
      await accountTable.initializeDevData(devAccounts);

      // 기존 데이터가 유지됨 (5개가 추가되지 않음)
      const all = await accountTable.getAll();
      expect(all).toHaveLength(1);
    });

    it("빈 DB에서 initializeDevData는 개발용 데이터를 채운다", async () => {
      const devAccounts = createTestAccounts(3);
      await accountTable.initializeDevData(devAccounts, testKey);

      const all = await accountTable.getAll(testKey);
      expect(all).toHaveLength(3);
    });

    it("복잡한 필드 구조도 암호화/복호화 정상 동작", async () => {
      const complexAccount: Omit<Account, "id" | "createdAt" | "updatedAt"> = {
        templateId: "1",
        title: "Complex Account",
        tags: ["tag1", "tag2", "한글태그"],
        favorite: true,
        fields: [
          { id: "f1", label: "Username", type: "text", value: "user@example.com", order: 0 },
          { id: "f2", label: "Password", type: "password", value: "p@ssw0rd!#$%^&*()", order: 1 },
          { id: "f3", label: "Notes", type: "text", value: "특수문자: \"'\\<>? 한글 日本語 🎉", order: 2 },
          { id: "f4", label: "TOTP", type: "totp", value: "JBSWY3DPEHPK3PXP", order: 3 },
        ],
        websiteUrl: "https://example.com/path?query=value",
        domain: "example.com",
        packageName: "com.example.app",
      };

      const created = await accountTable.create(complexAccount, testKey);
      const retrieved = await accountTable.getById(created.id, testKey);

      expect(retrieved).toBeDefined();
      expect(retrieved!.fields).toHaveLength(4);
      expect(retrieved!.fields[0].value).toBe("user@example.com");
      expect(retrieved!.fields[1].value).toBe("p@ssw0rd!#$%^&*()");
      expect(retrieved!.fields[2].value).toBe("특수문자: \"'\\<>? 한글 日本語 🎉");
      expect(retrieved!.fields[3].value).toBe("JBSWY3DPEHPK3PXP");
      expect(retrieved!.websiteUrl).toBe("https://example.com/path?query=value");
      expect(retrieved!.domain).toBe("example.com");
    });

    it("DB에 저장된 암호화 레코드 직접 조회 시 구조 확인", async () => {
      const testAccount = createTestAccounts(1)[0];
      const created = await accountTable.create(testAccount, testKey);

      const db = getDatabase();
      const rawRecord = await db.accounts.get(created.id);

      expect(rawRecord).toBeDefined();
      expect(rawRecord!.encrypted).toBe(true);
      // IndexedDB에서 가져온 Uint8Array는 일반 배열 형태일 수 있음
      expect(rawRecord!.encryptedData).toBeDefined();
      expect(rawRecord!.iv).toBeDefined();
      // Uint8Array로 변환 가능해야 함
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