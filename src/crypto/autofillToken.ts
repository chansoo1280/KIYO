import { toBase64Url } from "./crypto.utils";

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

export function isAutofillTokenValid(token: AutofillToken): boolean {
  if (!token || typeof token !== "object") {
    return false;
  }

  if (
    typeof token.token !== "string" ||
    typeof token.createdAt !== "number" ||
    typeof token.expiresAt !== "number"
  ) {
    return false;
  }

  if (token.token.length === 0) {
    return false;
  }

  const now = Date.now();
  return now < token.expiresAt;
}