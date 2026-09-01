import { useNavigate } from "react-router-dom";
import Button from "@/components/Button";

type ErrorScreenProps =
  | { variant: "generic"; error?: unknown }
  | { variant: "stale"; missingFileName: string };

/**
 * RootRedirect의 에러/데이터 정합성 화면.
 * - variant="generic": preload 실패 시 표시 (사용자 안내 + "홈으로" 버튼 → /home)
 * - variant="stale": store activeFileName이 DB에 존재하지 않을 때 표시
 *   (사용자가 명시적으로 다른 vault를 선택하도록 안내. clearSession은 호출 안 함 — 사용자 주도 복구)
 */
export function ErrorScreen(props: ErrorScreenProps) {
  const navigate = useNavigate();

  if (props.variant === "stale") {
    return (
      <main
        role="alert"
        aria-live="assertive"
        className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 py-8 text-[var(--color-text)]"
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-[var(--color-error-bg)] text-[var(--color-error)]">
            !
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-text-h)]">
            활성 파일을 찾을 수 없습니다
          </h1>
          <p className="text-center text-sm leading-6 text-[var(--color-text)]">
            마지막으로 열었던 파일이 저장소에서 사라졌습니다.
            <br />
            다른 파일을 선택하거나 새로 만들 수 있습니다.
          </p>
          <p className="text-xs text-[var(--color-text-muted)]" aria-label="누락된 파일명">
            {props.missingFileName}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button
              label="홈으로"
              variant="primary"
              onClick={() => navigate("/home", { replace: true })}
            />
          </div>
        </div>
      </main>
    );
  }

  // variant === "generic"
  const message = props.error instanceof Error ? props.error.message : "알 수 없는 오류";
  return (
    <main
      role="alert"
      aria-live="assertive"
      className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 py-8 text-[var(--color-text)]"
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-[var(--color-error-bg)] text-[var(--color-error)]">
          !
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-text-h)]">
          데이터를 불러올 수 없습니다
        </h1>
        <p className="text-center text-sm leading-6 text-[var(--color-text)]">
          잠금 해제는 되었지만 파일 데이터를 읽는 중 오류가 발생했습니다.
          <br />
          다른 파일을 선택하거나 새로 만들 수 있습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)]" aria-label="에러 상세">
          {message}
        </p>
        <div className="flex w-full flex-col gap-2">
          <Button
            label="홈으로"
            variant="primary"
            onClick={() => navigate("/home", { replace: true })}
          />
        </div>
      </div>
    </main>
  );
}