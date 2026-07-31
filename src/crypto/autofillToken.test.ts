import { describe, it, expect } from "vitest";
import {
  createAutofillToken,
  isAutofillTokenValid,
  type AutofillToken,
} from "@/crypto/autofillToken";

describe("autofillToken", () => {
  describe("createAutofillToken", () => {
    it("should create a token with correct structure", () => {
      const token = createAutofillToken();

      expect(token).toEqual({
        token: expect.any(String),
        createdAt: expect.any(Number),
        expiresAt: expect.any(Number),
      });
    });

    it("should create token with 30 minutes TTL", () => {
      const before = Date.now();
      const token = createAutofillToken();
      const after = Date.now();

      expect(token.expiresAt).toBeGreaterThanOrEqual(before + 30 * 60 * 1000);
      expect(token.expiresAt).toBeLessThanOrEqual(after + 30 * 60 * 1000);
      expect(token.expiresAt - token.createdAt).toBe(30 * 60 * 1000);
    });

    it("should create unique tokens on each call", () => {
      const token1 = createAutofillToken();
      const token2 = createAutofillToken();

      expect(token1.token).not.toBe(token2.token);
      // createdAt may be same if calls are in same millisecond, but tokens should differ
      expect(token1.token).not.toBe(token2.token);
    });

    it("should generate Base64URL encoded token (no +, /, =)", () => {
      const token = createAutofillToken();

      expect(token.token).not.toContain("+");
      expect(token.token).not.toContain("/");
      expect(token.token).not.toContain("=");
    });

    it("should generate token with sufficient entropy (43 chars for 32 bytes Base64URL)", () => {
      const token = createAutofillToken();

      // 32 bytes = 256 bits = 43 Base64URL chars (no padding)
      expect(token.token.length).toBe(43);
    });

    it("should have createdAt close to current time", () => {
      const before = Date.now();
      const token = createAutofillToken();
      const after = Date.now();

      expect(token.createdAt).toBeGreaterThanOrEqual(before);
      expect(token.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe("isAutofillTokenValid", () => {
    it("should return true for valid non-expired token", () => {
      const token = createAutofillToken();

      expect(isAutofillTokenValid(token)).toBe(true);
    });

    it("should return false for expired token", () => {
      const expiredToken: AutofillToken = {
        token: "valid-token-string",
        createdAt: Date.now() - 31 * 60 * 1000,
        expiresAt: Date.now() - 60 * 1000,
      };

      expect(isAutofillTokenValid(expiredToken)).toBe(false);
    });

    it("should return false for token expiring now", () => {
      const expiringToken: AutofillToken = {
        token: "valid-token-string",
        createdAt: Date.now() - 30 * 60 * 1000,
        expiresAt: Date.now(),
      };

      expect(isAutofillTokenValid(expiringToken)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isAutofillTokenValid(null as any)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isAutofillTokenValid(undefined as any)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isAutofillTokenValid("string" as any)).toBe(false);
      expect(isAutofillTokenValid(123 as any)).toBe(false);
      expect(isAutofillTokenValid([] as any)).toBe(false);
    });

    it("should return false for missing token field", () => {
      expect(
        isAutofillTokenValid({
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 60 * 1000,
        } as any),
      ).toBe(false);
    });

    it("should return false for missing createdAt field", () => {
      expect(
        isAutofillTokenValid({
          token: "valid-token",
          expiresAt: Date.now() + 30 * 60 * 1000,
        } as any),
      ).toBe(false);
    });

    it("should return false for missing expiresAt field", () => {
      expect(
        isAutofillTokenValid({
          token: "valid-token",
          createdAt: Date.now(),
        } as any),
      ).toBe(false);
    });

    it("should return false for wrong field types", () => {
      expect(
        isAutofillTokenValid({
          token: 123,
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 60 * 1000,
        } as any),
      ).toBe(false);

      expect(
        isAutofillTokenValid({
          token: "valid-token",
          createdAt: "not-a-number",
          expiresAt: Date.now() + 30 * 60 * 1000,
        } as any),
      ).toBe(false);

      expect(
        isAutofillTokenValid({
          token: "valid-token",
          createdAt: Date.now(),
          expiresAt: "not-a-number",
        } as any),
      ).toBe(false);
    });

    it("should return false for empty token string", () => {
      expect(
        isAutofillTokenValid({
          token: "",
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 60 * 1000,
        }),
      ).toBe(false);
    });

    it("should return true for token expiring in 1ms", () => {
      const token: AutofillToken = {
        token: "valid-token",
        createdAt: Date.now() - 30 * 60 * 1000 + 1,
        expiresAt: Date.now() + 1,
      };

      expect(isAutofillTokenValid(token)).toBe(true);
    });
  });

  describe("round-trip: create and validate", () => {
    it("should validate freshly created token", () => {
      const token = createAutofillToken();

      expect(isAutofillTokenValid(token)).toBe(true);
    });

    it("should produce tokens with correct Base64URL alphabet", () => {
      const token = createAutofillToken();

      // Base64URL alphabet: A-Z, a-z, 0-9, -, _
      expect(token.token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});