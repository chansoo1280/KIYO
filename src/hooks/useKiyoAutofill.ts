import { useState, useCallback, useEffect } from 'react';
import { KiyoAutofill, type AutofillStatus, type AutofillServiceInfo, type PingResponse } from '@/plugins/kiyautofill';

export interface UseKiyoAutofillReturn {
  status: AutofillStatus | null;
  serviceInfo: AutofillServiceInfo | null;
  pingResponse: PingResponse | null;
  loading: boolean;
  error: string | null;
  checkStatus: () => Promise<void>;
  ping: () => Promise<void>;
  getServiceInfo: () => Promise<void>;
  requestEnable: () => Promise<void>;
}

export const useKiyoAutofill = (): UseKiyoAutofillReturn => {
  const [status, setStatus] = useState<AutofillStatus | null>(null);
  const [serviceInfo, setServiceInfo] = useState<AutofillServiceInfo | null>(null);
  const [pingResponse, setPingResponse] = useState<PingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await KiyoAutofill.isAutofillEnabled();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const ping = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await KiyoAutofill.ping();
      setPingResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const getServiceInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await KiyoAutofill.getAutofillServiceInfo();
      setServiceInfo(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const requestEnable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await KiyoAutofill.requestAutofillEnable();
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [checkStatus]);

  // Auto-check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    status,
    serviceInfo,
    pingResponse,
    loading,
    error,
    checkStatus,
    ping,
    getServiceInfo,
    requestEnable,
  };
};