import pkg from "../../package.json" with { type: "json" };

/**
 * 앱 (React / WebView) 버전. package.json `version` 필드 source of truth.
 * `FileMetadata.version` 같은 vault 메타데이터에 저장되어 호환성 추적에 사용.
 */
export const APP_VERSION: string = pkg.version;