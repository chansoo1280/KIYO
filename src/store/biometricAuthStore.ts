import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  BiometryType,
  type CheckBiometryResult,
  BiometricAuth,
} from "@aparajita/capacitor-biometric-auth";

export interface BiometricAvailability {
  isAvailable: boolean;
  biometryType: "fingerprint" | "face" | "none" | "unknown";
  error?: string;
}

interface BiometricAuthState {
  // State
  biometricEnabled: boolean;
  isAvailable: boolean;
  biometryType: "fingerprint" | "face" | "none" | "unknown";
  error: string | null;
  status: "idle" | "checking" | "authenticating" | "success" | "error";

  // Actions
  setBiometricEnabled: (enabled: boolean) => void;
  setAvailability: (availability: BiometricAvailability) => void;
  setStatus: (status: BiometricAuthState["status"]) => void;
  setError: (error: string | null) => void;
  initializeBiometricAuthStore: () => Promise<BiometricAvailability>;
  reset: () => void;
}

const initialState = {
  biometricEnabled: false,
  isAvailable: false,
  biometryType: "unknown" as const,
  error: null,
  status: "idle" as const,
};

export const useBiometricAuthStore = create<BiometricAuthState>()(
  persist(
    (set) => ({
      ...initialState,

      /**
       * 사용자가 생체인증을 켰는지 여부 설정
       */
      setBiometricEnabled: (enabled: boolean) => {
        set({ biometricEnabled: enabled });
      },

      /**
       * 생체인증 가용성 상태 설정
       */
      setAvailability: (availability: BiometricAvailability) => {
        set({
          isAvailable: availability.isAvailable,
          biometryType: availability.biometryType,
          error: availability.error ?? null,
        });
      },

      /**
       * 상태 설정 (idle, checking, authenticating, success, error)
       */
      setStatus: (status: BiometricAuthState["status"]) => {
        set({ status });
      },

      /**
       * 에러 메시지 설정
       */
      setError: (error: string | null) => {
        set({ error });
      },

      /**
       * 앱 시작 시 생체인증 초기화 (가용성 확인)
       */
      initializeBiometricAuthStore:
        async (): Promise<BiometricAvailability> => {
          set({ status: "checking" });
          try {
            const result: CheckBiometryResult =
              await BiometricAuth.checkBiometry();

            let biometryType: BiometricAvailability["biometryType"] = "unknown";
            switch (result.biometryType) {
              case BiometryType.fingerprintAuthentication:
                biometryType = "fingerprint";
                break;
              case BiometryType.faceAuthentication:
              case BiometryType.faceId:
                biometryType = "face";
                break;
              case BiometryType.touchId:
                biometryType = "fingerprint";
                break;
              case BiometryType.none:
                biometryType = "none";
                break;
            }

            const availability: BiometricAvailability = {
              isAvailable: result.isAvailable,
              biometryType,
              error: result.isAvailable
                ? undefined
                : result.reason || "생체인증을 사용할 수 없습니다.",
            };

            set({
              isAvailable: availability.isAvailable,
              biometryType: availability.biometryType,
              error: availability.error ?? null,
              status: "idle",
            });

            return availability;
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : "생체인증 초기화 실패";
            set({
              isAvailable: false,
              biometricEnabled: false,
              biometryType: "unknown",
              error: errorMsg,
              status: "error",
            });
            return {
              isAvailable: false,
              biometryType: "unknown",
              error: errorMsg,
            };
          }
        },

      /**
       * 상태 초기화
       */
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "kiyo-biometric-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        biometricEnabled: state.biometricEnabled,
      }),
    },
  ),
);

export default useBiometricAuthStore;
