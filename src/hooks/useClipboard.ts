import { useCallback, useState } from "react";

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setRemainingTime(30);
      const timer = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCopied(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { copy, copied, remainingTime };
}