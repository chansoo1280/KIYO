import { useCallback } from 'react';
import { KiyoAutofill, type AutofillStatus } from '@/plugins/kiyautofill';

export interface UseAutofillReturn {
  isEnabled: () => Promise<AutofillStatus>;
  openSettings: () => Promise<void>;
}

export const useAutofill = (): UseAutofillReturn => {
  const isEnabled = useCallback(async (): Promise<AutofillStatus> => {
    return await KiyoAutofill.isAutofillEnabled();
  }, []);

  const openSettings = useCallback(async (): Promise<void> => {
    await KiyoAutofill.requestAutofillEnable();
  }, []);

  return {
    isEnabled,
    openSettings,
  };
};