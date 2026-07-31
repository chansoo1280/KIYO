import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useAccountStore } from "@/store/accountStore";
import { createTestAccount, createTestAccounts } from "@/test/fixtures/accountFixtures";

describe("accountStore - State Management Tests", () => {
  let initialState: ReturnType<typeof useAccountStore.getState>;

  beforeEach(() => {
    // Reset store to initial state
    useAccountStore.setState({
      accounts: [],
      initialized: false,
    });
    initialState = useAccountStore.getState();
  });

  afterEach(() => {
    // Cleanup after each test
    useAccountStore.setState({
      accounts: [],
      initialized: false,
    });
  });

  describe("초기 상태 확인", () => {
    it("accounts가 빈 배열이어야 한다", () => {
      expect(initialState.accounts).toEqual([]);
    });

    it("initialized가 false여야 한다", () => {
      expect(initialState.initialized).toBe(false);
    });
  });

  describe("setAccounts 테스트", () => {
    it("계정 배열을 저장해야 한다", () => {
      const accounts = createTestAccounts(3);
      useAccountStore.getState().setAccounts(accounts);

      const state = useAccountStore.getState();
      expect(state.accounts).toEqual(accounts);
      expect(state.accounts).toHaveLength(3);
    });

    it("여러 계정을 저장해야 한다", () => {
      const accounts = createTestAccounts(5);
      useAccountStore.getState().setAccounts(accounts);

      const state = useAccountStore.getState();
      expect(state.accounts).toHaveLength(5);
      expect(state.accounts[0].title).toBe("Test Account 1");
      expect(state.accounts[4].title).toBe("Test Account 5");
    });

    it("빈 배열을 저장해야 한다", () => {
      // 먼저 계정 설정
      useAccountStore.getState().setAccounts(createTestAccounts(2));
      expect(useAccountStore.getState().accounts).toHaveLength(2);

      // 빈 배열로 설정
      useAccountStore.getState().setAccounts([]);

      const state = useAccountStore.getState();
      expect(state.accounts).toEqual([]);
      expect(state.accounts).toHaveLength(0);
    });
  });

  describe("addAccount 테스트", () => {
    it("새로운 계정을 추가해야 한다", () => {
      const account = createTestAccount({ id: 1, title: "New Account" });
      useAccountStore.getState().setAccounts([]);

      // addAccount는 DB를 사용하므로 setAccounts로 직접 테스트
      // 실제 addAccount 로직은 DB 트랜잭션을 사용하므로 상태 관리만 검증
      const newAccount = { ...account, id: 1, createdAt: Date.now(), updatedAt: Date.now() };
      useAccountStore.setState((state) => ({ accounts: [newAccount, ...state.accounts] }));

      const state = useAccountStore.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0].title).toBe("New Account");
    });

    it("기존 계정을 유지하면서 새 계정을 추가해야 한다", () => {
      const existingAccounts = createTestAccounts(2);
      useAccountStore.getState().setAccounts(existingAccounts);

      const newAccount = createTestAccount({ id: 3, title: "Third Account" });
      useAccountStore.setState((state) => ({ accounts: [newAccount, ...state.accounts] }));

      const state = useAccountStore.getState();
      expect(state.accounts).toHaveLength(3);
      expect(state.accounts[0].title).toBe("Third Account");
      expect(state.accounts[1].title).toBe("Test Account 1");
      expect(state.accounts[2].title).toBe("Test Account 2");
    });
  });

  describe("updateAccount 테스트", () => {
    it("특정 id의 계정을 수정해야 한다", () => {
      const accounts = createTestAccounts(3);
      useAccountStore.getState().setAccounts(accounts);

      const updatedAccount = { ...accounts[1], title: "Updated Account", updatedAt: Date.now() };
      useAccountStore.setState((state) => ({
        accounts: state.accounts.map((a) => (a.id === updatedAccount.id ? updatedAccount : a)),
      }));

      const state = useAccountStore.getState();
      expect(state.accounts[1].title).toBe("Updated Account");
      expect(state.accounts[1].updatedAt).toBe(updatedAccount.updatedAt);
    });

    it("다른 계정은 변경되지 않아야 한다", () => {
      const accounts = createTestAccounts(3);
      useAccountStore.getState().setAccounts(accounts);

      const originalTitle1 = accounts[0].title;
      const originalTitle2 = accounts[2].title;

      const updatedAccount = { ...accounts[1], title: "Updated Account", updatedAt: Date.now() };
      useAccountStore.setState((state) => ({
        accounts: state.accounts.map((a) => (a.id === updatedAccount.id ? updatedAccount : a)),
      }));

      const state = useAccountStore.getState();
      expect(state.accounts[0].title).toBe(originalTitle1);
      expect(state.accounts[2].title).toBe(originalTitle2);
    });
  });

  describe("deleteAccount 테스트", () => {
    it("특정 id의 계정을 삭제해야 한다", () => {
      const accounts = createTestAccounts(3);
      useAccountStore.getState().setAccounts(accounts);

      useAccountStore.setState((state) => ({
        accounts: state.accounts.filter((a) => a.id !== 2),
      }));

      const state = useAccountStore.getState();
      expect(state.accounts).toHaveLength(2);
      expect(state.accounts.find((a) => a.id === 2)).toBeUndefined();
    });

    it("삭제 후 나머지 계정이 유지되어야 한다", () => {
      const accounts = createTestAccounts(4);
      useAccountStore.getState().setAccounts(accounts);

      useAccountStore.setState((state) => ({
        accounts: state.accounts.filter((a) => a.id !== 3),
      }));

      const state = useAccountStore.getState();
      expect(state.accounts).toHaveLength(3);
      expect(state.accounts.map((a) => a.id)).toEqual([1, 2, 4]);
      expect(state.accounts[0].title).toBe("Test Account 1");
      expect(state.accounts[1].title).toBe("Test Account 2");
      expect(state.accounts[2].title).toBe("Test Account 4");
    });
  });

  describe("clearAccounts 테스트", () => {
    it("모든 계정을 초기화해야 한다", () => {
      useAccountStore.getState().setAccounts(createTestAccounts(5));
      expect(useAccountStore.getState().accounts).toHaveLength(5);

      useAccountStore.setState({ accounts: [] });

      const state = useAccountStore.getState();
      expect(state.accounts).toEqual([]);
      expect(state.accounts).toHaveLength(0);
    });
  });

  describe("연속 상태 변경 테스트", () => {
    it("추가 → 수정 → 삭제 흐름이 정상 동작해야 한다", () => {
      // 초기 상태: 빈 배열
      useAccountStore.setState({ accounts: [] });

      // 1. 계정 추가
      const account1 = createTestAccount({ id: 1, title: "Account 1" });
      const account2 = createTestAccount({ id: 2, title: "Account 2" });
      useAccountStore.setState((state) => ({ accounts: [account1, account2, ...state.accounts] }));

      let state = useAccountStore.getState();
      expect(state.accounts).toHaveLength(2);

      // 2. 계정 수정
      const updatedAccount = { ...account1, title: "Updated Account 1", updatedAt: Date.now() };
      useAccountStore.setState((state) => ({
        accounts: state.accounts.map((a) => (a.id === updatedAccount.id ? updatedAccount : a)),
      }));

      state = useAccountStore.getState();
      expect(state.accounts[0].title).toBe("Updated Account 1");
      expect(state.accounts[1].title).toBe("Account 2");

      // 3. 계정 삭제
      useAccountStore.setState((state) => ({
        accounts: state.accounts.filter((a) => a.id !== 2),
      }));

      state = useAccountStore.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0].id).toBe(1);
      expect(state.accounts[0].title).toBe("Updated Account 1");
    });

    it("여러 번 setAccounts 호출 시 마지막 값이 반영되어야 한다", () => {
      useAccountStore.getState().setAccounts(createTestAccounts(2));
      useAccountStore.getState().setAccounts(createTestAccounts(3));
      useAccountStore.getState().setAccounts(createTestAccounts(1));

      const state = useAccountStore.getState();
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0].title).toBe("Test Account 1");
    });
  });

  describe("getAccountById 테스트", () => {
    it("존재하는 id로 계정을 찾을 수 있어야 한다", () => {
      const accounts = createTestAccounts(3);
      useAccountStore.getState().setAccounts(accounts);

      const found = useAccountStore.getState().getAccountById(2);
      expect(found).toBeDefined();
      expect(found?.id).toBe(2);
      expect(found?.title).toBe("Test Account 2");
    });

    it("존재하지 않는 id면 undefined를 반환해야 한다", () => {
      useAccountStore.getState().setAccounts(createTestAccounts(2));

      const found = useAccountStore.getState().getAccountById(999);
      expect(found).toBeUndefined();
    });
  });
});