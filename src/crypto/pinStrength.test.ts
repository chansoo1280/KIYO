import { describe, it, expect } from "vitest";
import {
  assessPinStrength,
  STRENGTH_LABELS,
  MIN_PIN_LENGTH,
  MAX_PIN_LENGTH,
} from "@/crypto/pinStrength";

describe("pinStrength (Plan-4 §7.1)", () => {
  describe("assessPinStrength", () => {
    it("① 빈 문자열 → score=0 (강도 표시: '매우 약함')", () => {
      expect(assessPinStrength("")).toBe(0);
    });

    it("② 3자리 → score=0 (짧은 입력도 '매우 약함')", () => {
      expect(assessPinStrength("123")).toBe(0);
      expect(assessPinStrength("ab")).toBe(0);
    });

    it("③ \"1234\" → score=0 (단조 시퀀스, '매우 약함')", () => {
      expect(assessPinStrength("1234")).toBe(0);
    });

    it("④ \"0000\" → score=0 (반복)", () => {
      expect(assessPinStrength("0000")).toBe(0);
    });

    it("⑤ \"9271\" → score=1 (랜덤 4자리, v4 결과)", () => {
      expect(assessPinStrength("9271")).toBe(1);
    });

    it("⑥ \"abcd\" → score=0 (단조 시퀀스, v4 결과)", () => {
      expect(assessPinStrength("abcd")).toBe(0);
    });

    it("⑦ \"Abc123!@#\" → score=3 (혼합, v4 결과)", () => {
      expect(assessPinStrength("Abc123!@#")).toBe(3);
    });

    it("⑧ 21자 (\"x\".repeat(21)) → null (MAX_PIN_LENGTH 초과 명시 차단)", () => {
      expect(assessPinStrength("x".repeat(21))).toBeNull();
      // 정확히 20자는 정상 동작 (점수 검증은 score 범위만)
      const result20 = assessPinStrength("x".repeat(20));
      expect(result20).not.toBeNull();
      expect([0, 1, 2, 3, 4]).toContain(result20);
    });

    it("STRENGTH_LABELS 매핑 (5단계 모두 정의됨)", () => {
      expect(Object.keys(STRENGTH_LABELS)).toHaveLength(5);
      expect(STRENGTH_LABELS[0]).toBe("매우 약함");
      expect(STRENGTH_LABELS[1]).toBe("약함");
      expect(STRENGTH_LABELS[2]).toBe("보통");
      expect(STRENGTH_LABELS[3]).toBe("강함");
      expect(STRENGTH_LABELS[4]).toBe("매우 강함");
    });
  });

  describe("상수", () => {
    it("MIN_PIN_LENGTH === 4", () => {
      expect(MIN_PIN_LENGTH).toBe(4);
    });

    it("MAX_PIN_LENGTH === 20", () => {
      expect(MAX_PIN_LENGTH).toBe(20);
    });
  });
});