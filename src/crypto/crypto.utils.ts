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
