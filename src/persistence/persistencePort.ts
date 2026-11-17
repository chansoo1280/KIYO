/**
 * persistencePort (저장 요청 인터페이스)
 * Store 계층이 자동 저장 요청을 전달하기 위한 인터페이스.
 * vaultPersistence가 구현을 등록하고, Store는 이 인터페이스를 통해 간접적으로 저장 요청을 보낸다.
 */

/** 저장 요청 핸들러 타입 */
export type SaveHandler = () => Promise<void>;

let handler: SaveHandler | null = null;

/**
 * 저장 요청 핸들러를 등록한다. (vaultPersistence에서 호출)
 * @param fn 저장 실행 함수
 */
export function registerSaveHandler(fn: SaveHandler): void {
  handler = fn;
}

/**
 * 등록된 저장 요청 핸들러를 실행한다. (Store에서 호출)
 * 핸들러가 등록되어 있지 않으면 no-op.
 */
export async function requestSave(): Promise<void> {
  await handler?.();
}
