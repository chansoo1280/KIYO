import { useAutoLock } from "@/hooks/useAutoLock";
import { AutoLockIndicator } from "@/components/AutoLockIndicator";
import type { ReactNode } from "react";

export function AutoLockProvider({ children }: { children: ReactNode }) {
  // Initialize auto-lock timer (needs Router context for useNavigate)
  useAutoLock();

  return (
    <>
      {children}
      <AutoLockIndicator />
    </>
  );
}