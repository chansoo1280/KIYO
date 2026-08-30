/**
 * Web Crypto API 가용성 체크.
 *
 * secure context (HTTPS / localhost / 127.0.0.1)에서만 `crypto.subtle`이 노출됨.
 * LAN IP / file:// / insecure origin에서는 `crypto.subtle`이 undefined.
 *
 * @returns crypto API 사용 가능 여
 *
 */
export const isCryptoAvailable = (): boolean => {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  );
};

/**
 * Web Crypto API 가용성 가드. 사용 불가 시 명시적 에러 throw.
 *
 * encryption.ts / recordEncryption.ts 진입부에서 호출하면
 * 비-secure context에서 사용자에게 친절한 메시지를 전달할 수 있음.
 */
export const assertCryptoAvailable = (): void => {
  if (!isCryptoAvailable()) {
    throw new CryptoUnavailableError(
      "Web Crypto API를 사용할 수 없는 환경입니다. HTTPS 또는 localhost로 접속해주세요.",
    );
  }
};

/**
 * Crypto API 부재 에러. FormDialog 등에서 catch 후 사용자 메시지로 변환 가능.
 */
export class CryptoUnavailableError extends Error {
  readonly code = "CRYPTO_UNAVAILABLE" as const;
  constructor(message: string) {
    super(message);
    this.name = "CryptoUnavailableError";
  }
}

export const toBase64 = (bytes: Uint8Array) => {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};

export const fromBase64 = (base64: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};
/**
 * CryptoKey를 Base64 문자열로 변환
 */
export const exportCryptoKey = async (
  cryptoKey: CryptoKey,
): Promise<string> => {
  try {
    const rawKey = await crypto.subtle.exportKey("raw", cryptoKey);

    return toBase64(new Uint8Array(rawKey));
  } catch (error) {
    console.error("CryptoKey export failed:", error instanceof Error ? error.message : String(error), error);
    throw error;
  }
};

export const toBase64Url = (bytes: Uint8Array): string => {
  const base64 = toBase64(bytes);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};
