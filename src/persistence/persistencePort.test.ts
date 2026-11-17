import { describe, it, expect, beforeEach } from "vitest";
import {
  registerSaveHandler,
  requestSave,
  type SaveHandler,
} from "@/persistence/persistencePort";

describe("persistencePort (저장 요청 인터페이스)", () => {
  beforeEach(() => {
    // 모듈 상태 초기화 (jest resetModules 방식 대신 로컬 스파이 사용)
    // persistencePort는 싱글톤 상태를 가지므로, 각 테스트 전 handler를 null로 리셋할 수단이 필요함
  });

  it("should export registerSaveHandler and requestSave", () => {
    expect(typeof registerSaveHandler).toBe("function");
    expect(typeof requestSave).toBe("function");
  });

  it("requestSave should resolve when no handler is registered", async () => {
    await expect(requestSave()).resolves.toBeUndefined();
  });

  it("requestSave should call registered handler", async () => {
    let called = false;
    const handler: SaveHandler = async () => {
      called = true;
    };
    registerSaveHandler(handler);
    await requestSave();
    expect(called).toBe(true);
  });

  it("requestSave should await handler completion", async () => {
    let resolved = false;
    const handler: SaveHandler = async () => {
      await new Promise((r) => setTimeout(r, 10));
      resolved = true;
    };
    registerSaveHandler(handler);
    await requestSave();
    expect(resolved).toBe(true);
  });
});
