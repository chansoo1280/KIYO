import { describe, it, expect } from "vitest";
import { mapError } from "@/utils/mapError";
import { FileStorageError } from "@/database/fileStorage.error";

describe("mapError (Plan-A1)", () => {
  it("① null → fallback 메시지", () => {
    expect(mapError(null)).toBe("알 수 없는 오류가 발생했습니다.");
  });

  it("② undefined → fallback 메시지", () => {
    expect(mapError(undefined)).toBe("알 수 없는 오류가 발생했습니다.");
  });

  it("③ FileStorageError(INVALID_PIN) → 'PIN 번호가 올바르지 않습니다.'", () => {
    const err = FileStorageError.invalidPin();
    expect(mapError(err)).toBe("PIN 번호가 올바르지 않습니다.");
  });

  it("④ FileStorageError(INVALID_JSON) → '파일 형식이 올바르지 않습니다.'", () => {
    const err = FileStorageError.invalidFileFormat("test.json");
    expect(mapError(err)).toBe("파일 형식이 올바르지 않습니다.");
  });

  it("⑤ FileStorageError(FILE_NOT_FOUND) → '파일을 찾을 수 없습니다.'", () => {
    const err = FileStorageError.fileNotFound("missing.json");
    expect(mapError(err)).toBe("파일을 찾을 수 없습니다.");
  });

  it("⑥ FileStorageError(STORAGE_QUOTA_EXCEEDED) → '저장 공간이 부족합니다.'", () => {
    const err = FileStorageError.storageQuotaExceeded();
    expect(mapError(err)).toBe("저장 공간이 부족합니다.");
  });

  it("⑦ 네이티브 에러 code='KIYO_AUTOFILL_NOT_AVAILABLE' → 한국어 매핑", () => {
    const err = { code: "KIYO_AUTOFILL_NOT_AVAILABLE" };
    expect(mapError(err)).toBe("자동완성 서비스를 사용할 수 없습니다.");
  });

  it("⑧ DOMException(QuotaExceededError) → '저장 공간이 부족합니다.'", () => {
    const err = new DOMException("quota", "QuotaExceededError");
    expect(mapError(err)).toBe("저장 공간이 부족합니다.");
  });

  it("⑨ CryptoUnavailableError → HTTPS 안내", () => {
    const err = new Error("Cannot read properties of undefined (reading 'crypto')");
    err.name = "CryptoUnavailableError";
    expect(mapError(err)).toBe(
      "이 환경에서는 암호화 기능을 사용할 수 없습니다. HTTPS 또는 localhost로 접속해주세요.",
    );
  });

  it("⑩ 한국어 Error.message → 그대로 노출 (무손실)", () => {
    const err = new Error("저장 공간이 부족합니다");
    expect(mapError(err)).toBe("저장 공간이 부족합니다");
  });

  it("⑪ 영문 Error → fallback 한국어", () => {
    const err = new Error("Some unexpected error");
    expect(mapError(err)).toBe("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  });

  it("⑫ string err (한국어) → 그대로", () => {
    expect(mapError("PIN 번호가 올바르지 않습니다.")).toBe(
      "PIN 번호가 올바르지 않습니다.",
    );
  });

  it("⑬ string err (영문) → fallback", () => {
    expect(mapError("Invalid PIN")).toBe("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  });

  it("⑭ number err → fallback 메시지", () => {
    expect(mapError(42)).toBe("알 수 없는 오류가 발생했습니다.");
  });

  it("⑮ DOMException(OperationError) → '데이터 처리 중 오류가 발생했습니다.'", () => {
    const err = new DOMException("fail", "OperationError");
    expect(mapError(err)).toBe("데이터 처리 중 오류가 발생했습니다.");
  });

  it("⑯ FileStorageError(PIN_MISMATCH) → 'PIN 번호가 올바르지 않습니다.'", () => {
    const err = FileStorageError.pinMismatch();
    expect(mapError(err)).toBe("PIN 번호가 올바르지 않습니다.");
  });
});
