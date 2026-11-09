import { describe, it, expect } from "vitest";
import {
  toBase64,
  fromBase64,
  isCryptoAvailable,
  assertCryptoAvailable,
  CryptoUnavailableError,
} from "@/crypto/crypto.utils";

describe("crypto.utils", () => {
  describe("toBase64", () => {
    it("should convert Uint8Array to base64 string", () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = toBase64(bytes);
      expect(result).toBe("SGVsbG8=");
    });

    it("should handle empty array", () => {
      const bytes = new Uint8Array([]);
      const result = toBase64(bytes);
      expect(result).toBe("");
    });

    it("should handle special characters", () => {
      const bytes = new Uint8Array([0, 255, 128, 64]);
      const result = toBase64(bytes);
      expect(result).toBe("AP+AQA==");
    });
  });

  describe("fromBase64", () => {
    it("should convert base64 string to Uint8Array", () => {
      const base64 = "SGVsbG8=";
      const result = fromBase64(base64);
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it("should handle empty string", () => {
      const base64 = "";
      const result = fromBase64(base64);
      expect(result).toEqual(new Uint8Array([]));
    });

    it("should handle special characters", () => {
      const base64 = "AP+AQA==";
      const result = fromBase64(base64);
      expect(result).toEqual(new Uint8Array([0, 255, 128, 64]));
    });
  });

  describe("Web Crypto API 가용성 가드", () => {
    it("isCryptoAvailable: jsdom 환경에서 true 반환 (Web Crypto API 지원)", () => {
      expect(isCryptoAvailable()).toBe(true);
    });

    it("assertCryptoAvailable: jsdom 환경에서 throw 안 함", () => {
      expect(() => assertCryptoAvailable()).not.toThrow();
    });

    it("CryptoUnavailableError: code/name/message 필드 확인", () => {
      const err = new CryptoUnavailableError("test message");
      expect(err.code).toBe("CRYPTO_UNAVAILABLE");
      expect(err.name).toBe("CryptoUnavailableError");
      expect(err.message).toBe("test message");
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("roundtrip", () => {
    it("should convert to base64 and back correctly", () => {
      const original = new Uint8Array([0, 1, 2, 255, 254, 253, 128, 64]);
      const base64 = toBase64(original);
      const result = fromBase64(base64);
      expect(result).toEqual(original);
    });

    it("should handle longer strings", () => {
      const original = new Uint8Array([
        72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33, 32, 84, 104,
        105, 115, 32, 105, 115, 32, 97, 32, 116, 101, 115, 116, 32, 115, 116,
        114, 105, 110, 103, 32, 119, 105, 116, 104, 32, 115, 112, 101, 99, 105,
        97, 108, 32, 99, 104, 97, 114, 115, 58, 32, 33, 64, 35, 36, 37, 94, 38,
        42, 40, 41,
      ]);
      const base64 = toBase64(original);
      const result = fromBase64(base64);
      expect(result).toEqual(original);
    });
  });
});
