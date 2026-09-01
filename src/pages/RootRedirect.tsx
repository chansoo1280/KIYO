import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SplashScreen } from "@/components/SplashScreen";
import { ErrorScreen } from "@/components/ErrorScreen";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { fileTable } from "@/database/fileTable";
import type { ActiveFileInfo } from "@/database/fileTable";
import { initializeStores } from "@/database/fileStorage";

/**
 * `/` 진입점 — 세션 + 파일 상태에 따라 분기:
 *
 *   - activeFileName === null       → /home navigate (파일 선택 UI)
 *   - activeFileName !== null, encrypted === true, cryptoKey === null
 *                                   → /auth navigate (PIN 입력)
 *   - activeFileName !== null, encrypted === true, cryptoKey !== null
 *                                   → Splash 표시하며 loadAccounts + loadTemplates 병렬 await
 *                                       ├─ 성공 → /accounts navigate (replace)
 *                                       └─ 실패 → ErrorScreen 표시
 *   - activeFileName !== null, encrypted === false
 *                                   → Splash 표시하며 loadAccounts + loadTemplates 병렬 await
 *                                       ├─ 성공 → /accounts navigate (replace)
 *                                       └─ 실패 → ErrorScreen 표시
 *
 * 상태 머신: 4-state (checking | preloading | redirecting | error)
 * - checking: 초기 + activeFileName 변경 직후 getFileInfo 결과 대기
 * - preloading: getFileInfo 완료 + unlocked/plaintext → loadStores 진행
 * - redirecting: navigate 의도 발생 → effect가 navigate 실행
 * - error: getFileInfo 또는 preload 실패 → ErrorScreen 표시
 *
 * Stale 감지는 info.activeFileName === null 단일 검사.
 */

type Status =
  | { kind: "checking" }
  | { kind: "preloading" }
  | { kind: "redirecting"; target: "/home" | "/auth" | "/accounts" }
  | { kind: "error"; error: unknown };

export function RootRedirect() {
  const navigate = useNavigate();
  // Zustand selector — 컴포넌트가 activeFileName/cryptoKey에 의존함을 React에 선언
  const activeFileName = useSessionStore((s) => s.activeFileName);
  const cryptoKey = useSessionStore((s) => s.cryptoKey);
  const loadAccounts = useAccountStore((s) => s.loadAccounts);
  const loadTemplates = useTemplateStore((s) => s.loadTemplates);

  const [status, setStatus] = useState<Status>({ kind: "checking" });
  // info === null: activeFileName 없거나 getFileInfo 미실행.
  // info !== null: getFileInfo 완료. stale은 info.activeFileName === null로 단일 검사.
  const [info, setInfo] = useState<ActiveFileInfo | null>(null);

  // 1. activeFileName 변경 시 fileInfo 재조회.
  // activeFileName null → info를 null로 두고 status=redirecting/target=/home.
  // activeFileName set → getFileInfo 결과로 info 채움 (stale이면 activeFileName이 null).
  useEffect(() => {
    let cancelled = false;
    if (!activeFileName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfo(null);
      setStatus({ kind: "redirecting", target: "/home" });
      return;
    }
    (async () => {
      try {
        const result = await fileTable.getFileInfo(activeFileName);
        if (cancelled) return;
        setInfo(result);
      } catch (err) {
        if (cancelled) return;
        setStatus({ kind: "error", error: err });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFileName]);

  // 2. info 결정 후 분기 (redirecting vs preloading).
  // info.activeFileName === null이면 stale — 분기 보류 후 effect 5에서 ErrorScreen 렌더.
  // info.encrypted && cryptoKey === null → /auth redirect.
  // 그 외(unlocked/plaintext) → preload.
  useEffect(() => {
    if (status.kind !== "checking") return;
    if (!info) return; // effect 1 진행 중
    if (!info.activeFileName) return; // stale — effect 5에서 ErrorScreen
    if (info.encrypted && cryptoKey === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus({ kind: "redirecting", target: "/auth" });
      return;
    }
    setStatus({ kind: "preloading" });
  }, [status.kind, info, cryptoKey]);

  // 3. preload 시작 (status=preloading 시 1회).
  // status.kind 의존성만 사용 — status가 preloading이 되는 순간만 발화.
  // preload 완료 후 status=redirecting → 이 effect는 재실행되지만 status.kind !== "preloading"이라 return.
  //
  // Dexie close race 보호 (Plan-D PR 1 회귀 수정):
  // - Dexie가 close → reopen cycle에서 진행 중이던 read operation이 reject도 resolve도 안 함
  // - PR 1 이전 useEffect fire-and-forget 흐름은 catch로 isLoading 정리됐으나,
  //   본 RootRedirect의 await는 영원히 pending → 사용자가 "계정을 불러오는 중..." 영원히 봄
  // - 각 시도에 timeout 3초 + 실패 시 1회 재시도. 재시도도 실패 시 ErrorScreen 표시.
  // - timeout 3초: 정상 초기화 + race 흡수 여유분 (E2E 10초 budget 내 동작)
  useEffect(() => {
    if (status.kind !== "preloading") return;
    let cancelled = false;

    const PRELOAD_TIMEOUT_MS = 3000;
    const runOnce = async (): Promise<
      { ok: true } | { ok: false; error: unknown }
    > => {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error("preload timeout")),
          PRELOAD_TIMEOUT_MS,
        );
      });
      try {
        await Promise.race([
          initializeStores(),
          timeoutPromise,
        ]);
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    };

    (async () => {
      const first = await runOnce();
      if (cancelled) return;
      if (first.ok) {
        setStatus({ kind: "redirecting", target: "/accounts" });
        return;
      }
      // 첫 시도 실패. timeout 또는 store-not-ready 케이스만 retryable.
      // 명시 reject (예: 사용자 코드 throw)은 즉시 에러 처리.
      // Dexie close race가 store setState를 누락한 경우도 retry로 흡수.
      const isRetryable =
        first.error instanceof Error &&
        (first.error.message === "preload timeout" ||
          first.error.message.includes("store not ready"));
      if (!isRetryable) {
        setStatus({ kind: "error", error: first.error });
        return;
      }
      // timeout 재시도
      const second = await runOnce();
      if (cancelled) return;
      if (!second.ok) {
        setStatus({ kind: "error", error: second.error });
        return;
      }
      setStatus({ kind: "redirecting", target: "/accounts" });
    })();

    return () => {
      cancelled = true;
    };
  }, [status.kind, loadAccounts, loadTemplates]);

  // 4. redirecting 상태일 때 navigate 실행.
  useEffect(() => {
    if (status.kind !== "redirecting") return;
    navigate(status.target, { replace: true });
  }, [status, navigate]);

  // 5. stale info 시 ErrorScreen 표시 (clearSession은 호출 안 함 — 사용자가 명시적 복구).
  if (info && !info.activeFileName && activeFileName) {
    return <ErrorScreen variant="stale" missingFileName={activeFileName} />;
  }

  if (status.kind === "error") {
    return <ErrorScreen variant="generic" error={status.error} />;
  }

  return <SplashScreen />;
}

export default RootRedirect;