import { toBase64Url } from "@/crypto/crypto.utils";

export interface AutofillToken {
  token: string;
  createdAt: number;
  expiresAt: number;
}

const TOKEN_BYTE_LENGTH = 32;
const TOKEN_TTL_MS = 30 * 60 * 1000;

export function createAutofillToken(): AutofillToken {
  const now = Date.now();
  const tokenBytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTE_LENGTH));
  const token = toBase64Url(tokenBytes);

  return {
    token,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
}

export function isAutofillTokenValid(token: unknown): boolean {
  if (!token || typeof token !== "object") {
    return false;
  }

  const t = token as Record<string, unknown>;
  if (
    typeof t.token !== "string" ||
    typeof t.createdAt !== "number" ||
    typeof t.expiresAt !== "number"
  ) {
    return false;
  }

  if (t.token.length === 0) {
    return false;
  }

  const now = Date.now();
  return now < t.expiresAt;
}