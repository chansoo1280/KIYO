import { useEffect } from "react";
import { Spinner } from "@/components/feedback/Spinner";

/**
 * RootRedirect의 unlock-preload 진행 중 표시되는 splash.
 * index.html의 inline splash DOM (`#splash`)을 mount 시 정리.
 */
export function SplashScreen() {
  useEffect(() => {
    // index.html의 inline splash DOM 제거
    const el = document.getElementById("splash");
    if (el) el.remove();
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="앱 초기화 중"
      className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)]"
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" aria-hidden />
        <span className="text-sm">kiyo</span>
      </div>
    </div>
  );
}