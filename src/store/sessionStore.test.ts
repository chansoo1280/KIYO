import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useSessionStore } from "./sessionStore";

// Simple test fixtures
const createTestCryptoKey = (): CryptoKey => {
  return {
    type: "secret",
    extractable: true,
    algorithm: { name: "AES-GCM" },
    usages: ["encrypt", "decrypt"],
  } as CryptoKey;
};

const createTestSalt = (): Uint8Array => {
  return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
};

describe("sessionStore - State Management Tests", () => {
  // Store state before each test
  let initialState: ReturnType<typeof useSessionStore.getState>;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store to initial state
    useSessionStore.setState({
      activeFileName: null,
      cryptoKey: null,
      salt: null,
    });
    initialState = useSessionStore.getState();
  });

  afterEach(() => {
    // Cleanup after each test
    localStorage.clear();
    useSessionStore.setState({
      activeFileName: null,
      cryptoKey: null,
      salt: null,
    });
  });

  describe("초기 상태 확인", () => {
    it("activeFileName이 null이어야 한다", () => {
      expect(initialState.activeFileName).toBeNull();
    });

    it("cryptoKey가 null이어야 한다", () => {
      expect(initialState.cryptoKey).toBeNull();
    });

    it("salt가 null이어야 한다", () => {
      expect(initialState.salt).toBeNull();
    });
  });

  describe("setSession 테스트", () => {
    it("fileName을 설정해야 한다", async () => {
      await useSessionStore.getState().setSession({ fileName: "test.json" });

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBe("test.json");
      expect(state.cryptoKey).toBeNull();
      expect(state.salt).toBeNull();
    });

    it("cryptoKey를 설정해야 한다", async () => {
      const cryptoKey = createTestCryptoKey();
      await useSessionStore.getState().setSession({
        fileName: "test.json",
        cryptoKey,
      });

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBe("test.json");
      expect(state.cryptoKey).toBe(cryptoKey);
      expect(state.salt).toBeNull();
    });

    it("salt를 설정해야 한다", async () => {
      const salt = createTestSalt();
      await useSessionStore.getState().setSession({
        fileName: "test.json",
        salt,
      });

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBe("test.json");
      expect(state.cryptoKey).toBeNull();
      expect(state.salt).toEqual(salt);
    });

    it("모든 값을 함께 설정해야 한다", async () => {
      const cryptoKey = createTestCryptoKey();
      const salt = createTestSalt();
      await useSessionStore.getState().setSession({
        fileName: "test.json",
        cryptoKey,
        salt,
      });

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBe("test.json");
      expect(state.cryptoKey).toBe(cryptoKey);
      expect(state.salt).toEqual(salt);
    });

    it("일부 값만 전달했을 때 기존 상태를 유지해야 한다", async () => {
      // First, set initial values
      const initialCryptoKey = createTestCryptoKey();
      const initialSalt = createTestSalt();
      await useSessionStore.getState().setSession({
        fileName: "initial.json",
        cryptoKey: initialCryptoKey,
        salt: initialSalt,
      });

      // Then update only fileName
      await useSessionStore.getState().setSession({ fileName: "updated.json" });

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBe("updated.json");
      expect(state.cryptoKey).toBe(initialCryptoKey);
      expect(state.salt).toEqual(initialSalt);
    });

    it("fileName을 null로 전달하면 activeFileName이 null이 되어야 한다", async () => {
      await useSessionStore.getState().setSession({ fileName: "test.json" });
      await useSessionStore.getState().setSession({ fileName: null });

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBeNull();
    });
  });

  describe("setCryptoKey 테스트", () => {
    it("CryptoKey와 salt를 저장해야 한다", async () => {
      const cryptoKey = createTestCryptoKey();
      const salt = createTestSalt();

      await useSessionStore.getState().setCryptoKey(cryptoKey, salt);

      const state = useSessionStore.getState();
      expect(state.cryptoKey).toBe(cryptoKey);
      expect(state.salt).toEqual(salt);
    });

    it("기존 activeFileName을 유지해야 한다", async () => {
      await useSessionStore.getState().setSession({ fileName: "test.json" });

      const cryptoKey = createTestCryptoKey();
      const salt = createTestSalt();
      await useSessionStore.getState().setCryptoKey(cryptoKey, salt);

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBe("test.json");
      expect(state.cryptoKey).toBe(cryptoKey);
      expect(state.salt).toEqual(salt);
    });
  });

  describe("clearSession 테스트", () => {
    it("activeFileName, cryptoKey, salt 모두 초기화해야 한다", async () => {
      const cryptoKey = createTestCryptoKey();
      const salt = createTestSalt();
      await useSessionStore.getState().setSession({
        fileName: "test.json",
        cryptoKey,
        salt,
      });

      await useSessionStore.getState().clearSession();

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBeNull();
      expect(state.cryptoKey).toBeNull();
      expect(state.salt).toBeNull();
    });

    it("초기 상태에서 clearSession을 호출해도 에러가 없어야 한다", async () => {
      await expect(
        useSessionStore.getState().clearSession()
      ).resolves.not.toThrow();

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBeNull();
      expect(state.cryptoKey).toBeNull();
      expect(state.salt).toBeNull();
    });
  });

  describe("여러 번 setSession 호출 시 최신 값으로 변경되는지 확인", () => {
    it("연속된 setSession 호출 시 마지막 값이 반영되어야 한다", async () => {
      await useSessionStore.getState().setSession({ fileName: "first.json" });
      await useSessionStore.getState().setSession({ fileName: "second.json" });
      await useSessionStore.getState().setSession({ fileName: "third.json" });

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBe("third.json");
    });

    it("cryptoKey와 salt도 마지막 값으로 업데이트되어야 한다", async () => {
      const key1 = createTestCryptoKey();
      const salt1 = createTestSalt();
      const key2 = createTestCryptoKey();
      const salt2 = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
      const key3 = createTestCryptoKey();
      const salt3 = new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9]);

      await useSessionStore
        .getState()
        .setSession({ fileName: "test.json", cryptoKey: key1, salt: salt1 });
      await useSessionStore
        .getState()
        .setSession({ fileName: "test.json", cryptoKey: key2, salt: salt2 });
      await useSessionStore
        .getState()
        .setSession({ fileName: "test.json", cryptoKey: key3, salt: salt3 });

      const state = useSessionStore.getState();
      expect(state.cryptoKey).toBe(key3);
      expect(state.salt).toEqual(salt3);
    });

    it("setSession 후 setCryptoKey 호출 시 cryptoKey와 salt가 업데이트되어야 한다", async () => {
      const initialKey = createTestCryptoKey();
      const initialSalt = createTestSalt();
      await useSessionStore.getState().setSession({
        fileName: "test.json",
        cryptoKey: initialKey,
        salt: initialSalt,
      });

      const newKey = createTestCryptoKey();
      const newSalt = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
      await useSessionStore.getState().setCryptoKey(newKey, newSalt);

      const state = useSessionStore.getState();
      expect(state.activeFileName).toBe("test.json");
      expect(state.cryptoKey).toBe(newKey);
      expect(state.salt).toEqual(newSalt);
    });
  });
});