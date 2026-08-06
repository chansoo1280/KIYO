import { useState, useCallback } from "react";

export interface DialogState {
  open: boolean;
  isLoading: boolean;
  errorMessage: string;
  confirmDisabled: boolean;
}

export interface UseDialogOptions {
  onConfirm?: () => Promise<void>;
  onClose?: () => void;
  initialConfirmDisabled?: boolean;
}

export function useDialog(options: UseDialogOptions = {}) {
  const [state, setState] = useState<DialogState>({
    open: false,
    isLoading: false,
    errorMessage: "",
    confirmDisabled: options.initialConfirmDisabled ?? false,
  });

  const open = useCallback(() => {
    setState((s) => ({
      ...s,
      open: true,
      errorMessage: "",
      confirmDisabled: options.initialConfirmDisabled ?? false,
    }));
  }, [options.initialConfirmDisabled]);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false, isLoading: false, errorMessage: "" }));
    options.onClose?.();
  }, [options.onClose]);

  const setLoading = useCallback((loading: boolean) => {
    setState((s) => ({ ...s, isLoading: loading }));
  }, []);

  const setError = useCallback((message: string) => {
    setState((s) => ({ ...s, errorMessage: message, isLoading: false }));
  }, []);

  const setConfirmDisabled = useCallback((disabled: boolean) => {
    setState((s) => ({ ...s, confirmDisabled: disabled }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (state.confirmDisabled || state.isLoading) return;
    setState((s) => ({ ...s, isLoading: true, errorMessage: "" }));
    try {
      await options.onConfirm?.();
      close();
    } catch (err) {
      setState((s) => ({
        ...s,
        errorMessage: err instanceof Error ? err.message : "오류가 발생했습니다.",
        isLoading: false,
      }));
    }
  }, [state.confirmDisabled, state.isLoading, options.onConfirm, close]);

  return { ...state, open, close, isLoading: state.isLoading, errorMessage: state.errorMessage, setLoading, setError, setConfirmDisabled, handleConfirm };
}