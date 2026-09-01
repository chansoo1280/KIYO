import {
  FileStorageErrorCode,
  isFileStorageError,
} from "@/errors/FileStorageError";

/**
 * 에러를 사용자 가시 한국어 메시지로 변환.
 *
 * 분류:
 * 1. FileStorageError — code별 한국어 매핑
 * 2. 네이티브 Capacitor 에러 — `code` 필드 기반 매핑
 * 3. DOMException (Web Crypto / IndexedDB) — name 기반 매핑
 * 4. 일반 Error — 한국어면 그대로, 영문이면 fallback
 * 5. 알 수 없는 타입 — fallback 메시지
 */
export function mapError(err: unknown): string {
  if (err == null) {
    return "알 수 없는 오류가 발생했습니다.";
  }

  // 1. FileStorageError — code별 한국어 매핑
  if (isFileStorageError(err)) {
    switch (err.code) {
      case FileStorageErrorCode.FILE_NOT_FOUND:
        return "파일을 찾을 수 없습니다.";
      case FileStorageErrorCode.FILE_READ_ERROR:
      case FileStorageErrorCode.FILE_READ_FAILED:
        return "파일을 읽을 수 없습니다.";
      case FileStorageErrorCode.FILE_WRITE_ERROR:
      case FileStorageErrorCode.FILE_WRITE_FAILED:
      case FileStorageErrorCode.WRITE_FAILED:
        return "파일을 저장할 수 없습니다.";
      case FileStorageErrorCode.FILE_DELETE_ERROR:
        return "파일을 삭제할 수 없습니다.";
      case FileStorageErrorCode.FILE_ALREADY_EXISTS:
        return "같은 이름의 파일이 이미 존재합니다.";
      case FileStorageErrorCode.INVALID_FILE_FORMAT:
      case FileStorageErrorCode.INVALID_JSON:
      case FileStorageErrorCode.INVALID_FORMAT:
      case FileStorageErrorCode.INVALID_DATA_FORMAT:
        return "파일 형식이 올바르지 않습니다.";
      case FileStorageErrorCode.ENCRYPTION_ERROR:
      case FileStorageErrorCode.ENCRYPTION_FAILED:
        return "데이터 암호화에 실패했습니다.";
      case FileStorageErrorCode.DECRYPTION_ERROR:
      case FileStorageErrorCode.DECRYPTION_FAILED:
        return "데이터 복호화에 실패했습니다.";
      case FileStorageErrorCode.INVALID_PIN:
      case FileStorageErrorCode.PIN_MISMATCH:
        return "PIN 번호가 올바르지 않습니다.";
      case FileStorageErrorCode.INVALID_SALT:
      case FileStorageErrorCode.SALT_MISMATCH:
        return "암호화 솔트가 유효하지 않습니다.";
      case FileStorageErrorCode.INVALID_KEY:
      case FileStorageErrorCode.KEY_DERIVATION_FAILED:
        return "암호화 키 생성에 실패했습니다.";
      case FileStorageErrorCode.STORAGE_UNAVAILABLE:
        return "저장소를 사용할 수 없습니다.";
      case FileStorageErrorCode.PERMISSION_DENIED:
        return "권한이 없어 작업을 완료할 수 없습니다.";
      case FileStorageErrorCode.DATABASE_ERROR:
      case FileStorageErrorCode.DATABASE_CONNECTION_FAILED:
      case FileStorageErrorCode.DATABASE_QUERY_FAILED:
        return "데이터베이스 오류가 발생했습니다.";
      case FileStorageErrorCode.FILE_CORRUPTED:
        return "파일이 손상되었습니다.";
      case FileStorageErrorCode.INVALID_FILE_NAME:
        return "파일 이름이 올바르지 않습니다.";
      case FileStorageErrorCode.FILE_TOO_LARGE:
        return "파일이 너무 큽니다.";
      case FileStorageErrorCode.STORAGE_QUOTA_EXCEEDED:
        return "저장 공간이 부족합니다.";
      case FileStorageErrorCode.UNKNOWN_ERROR:
      default:
        return "파일 작업 중 오류가 발생했습니다.";
    }
  }

  // 2. 네이티브 Capacitor 에러 — `code` 필드 기반
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "KIYO_AUTOFILL_NOT_AVAILABLE") {
      return "자동완성 서비스를 사용할 수 없습니다.";
    }
    if (code === "KIYO_KEYSTORE_UNAVAILABLE") {
      return "Android 키 저장소를 사용할 수 없습니다.";
    }
  }

  // 3. DOMException (Web Crypto / IndexedDB)
  if (err instanceof DOMException) {
    if (err.name === "OperationError") {
      return "데이터 처리 중 오류가 발생했습니다.";
    }
    if (err.name === "QuotaExceededError") {
      return "저장 공간이 부족합니다.";
    }
    if (err.name === "NotFoundError") {
      return "데이터를 찾을 수 없습니다.";
    }
    if (err.name === "InvalidStateError") {
      return "데이터 저장소가 비활성 상태입니다.";
    }
  }

  // 4. 일반 Error — 한국어면 그대로, 아니면 fallback
  if (err instanceof Error) {
    // CryptoUnavailableError / Web Crypto API 사용 불가 (Plan-4 follow-up 통합)
    if (
      err.name === "CryptoUnavailableError" ||
      /Cannot read properties of undefined.*crypto/i.test(err.message) ||
      /crypto\.subtle is undefined/i.test(err.message) ||
      /secure context/i.test(err.message) ||
      /Cannot read properties of undefined.*importKey/i.test(err.message) ||
      /Cannot read properties of undefined.*deriveKey/i.test(err.message) ||
      /Cannot read properties of undefined.*encrypt/i.test(err.message) ||
      /Cannot read properties of undefined.*decrypt/i.test(err.message) ||
      /Cannot read properties of undefined.*getRandomValues/i.test(err.message)
    ) {
      return "이 환경에서는 암호화 기능을 사용할 수 없습니다. HTTPS 또는 localhost로 접속해주세요.";
    }
    // 한국어가 포함된 메시지는 그대로 노출 (이미 사용자 친화적)
    if (/[가-힣]/.test(err.message)) {
      return err.message;
    }
    // 영문은 fallback
    return "오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  // 5. 알 수 없는 타입
  if (typeof err === "string") {
    return /[가-힣]/.test(err) ? err : "오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  return "알 수 없는 오류가 발생했습니다.";
}
