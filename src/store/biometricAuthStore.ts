import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  BiometryType,
  type CheckBiometryResult,
  BiometricAuth,
} from "@aparajita/capacitor-biometric-auth";
import { exportCryptoKey, fromBase64 } from "../crypto/crypto.utils";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

type BiometricAuthResult = { success: true; cryptoKey: CryptoKey } | null;

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

  // Biometric auth actions (moved from useBiometricAuth hook)
  authenticate: (options?: {
    reason?: string;
    cancelTitle?: string;
    allowDeviceCredential?: boolean;
    androidTitle?: string;
    androidSubtitle?: string;
    androidConfirmationRequired?: boolean;
    androidBiometryStrength?: number;
    iosFallbackTitle?: string;
  }) => Promise<BiometricAuthResult>;
  enableBiometric: (options: {
    reason?: string;
    cancelTitle?: string;
    allowDeviceCredential?: boolean;
    androidTitle?: string;
    androidSubtitle?: string;
    androidConfirmationRequired?: boolean;
    androidBiometryStrength?: number;
    iosFallbackTitle?: string;
    cryptoKey: CryptoKey;
  }) => Promise<{ success: boolean; error?: string }>;
  disableBiometric: () => Promise<{ success: boolean; error?: string }>;
  getCryptoKey: () => Promise<CryptoKey | null>;
  saveCryptoKey: (cryptoKey: CryptoKey) => Promise<boolean>;
  clearCryptoKey: () => Promise<boolean>;
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
    (set, get) => ({
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

      /**
       * 생체인증 수행 및 암호키 반환
       */
      authenticate: async (options?) => {
        set({ status: "authenticating" });
        try {
          await BiometricAuth.authenticate({
            reason: options?.reason || "인증이 필요합니다.",
            cancelTitle: options?.cancelTitle || "취소",
            allowDeviceCredential: options?.allowDeviceCredential ?? true,
            androidTitle: options?.androidTitle,
            androidSubtitle: options?.androidSubtitle,
            androidConfirmationRequired: options?.androidConfirmationRequired,
            androidBiometryStrength: options?.androidBiometryStrength,
            iosFallbackTitle: options?.iosFallbackTitle,
          });

          // 생체인증 성공 시 Secure Storage에서 암호키 복원
          const CRYPTO_KEY_KEY = "biometric_crypto_key";
          const encodedKey = await SecureStorage.get(CRYPTO_KEY_KEY);

          if (encodedKey && typeof encodedKey === "string") {
            const rawKey = fromBase64(encodedKey);

            const cryptoKey = await crypto.subtle.importKey(
              "raw",
              rawKey,
              {
                name: "AES-GCM",
              },
              true,
              ["encrypt", "decrypt"],
            );

            set({ status: "success", error: null });
            return {
              success: true,
              cryptoKey,
            };
          }

          const errorMsg =
            "저장된 암호키가 없습니다. PIN으로 잠금 해제 후 다시 시도해주세요.";
          set({ status: "error", error: errorMsg });
          return null;
        } catch (error) {
          let errorMsg = "생체 인증 중 오류가 발생했습니다.";

          // 에러 처리 로직 (이전 useBiometricAuth에서 가져옴)
          set({ status: "error", error: errorMsg });
          return null;
        }
      },

      /**
       * 생체인증 활성화 (설정에서 생체인증 켤 때 사용)
       */
      enableBiometric: async (options) => {
        // 생체인증 가용성 확인
        if (!get().isAvailable) {
          const errorMsg = "이 기기에서는 생체인증을 사용할 수 없습니다.";
          set({ error: errorMsg });
          return { success: false, error: errorMsg };
        }

        if (!options?.cryptoKey) {
          const errorMsg =
            "암호키가 필요합니다. PIN으로 잠금 해제 후 다시 시도해주세요.";
          set({ error: errorMsg });
          return { success: false, error: errorMsg };
        }

        set({ status: "authenticating" });
        try {
          // 생체인증 수행
          await BiometricAuth.authenticate({
            reason: options?.reason || "생체인증을 활성화합니다.",
            cancelTitle: options?.cancelTitle || "취소",
            allowDeviceCredential: options?.allowDeviceCredential ?? true,
            androidTitle: options?.androidTitle,
            androidSubtitle: options?.androidSubtitle,
            androidConfirmationRequired: options?.androidConfirmationRequired,
            androidBiometryStrength: options?.androidBiometryStrength,
            iosFallbackTitle: options?.iosFallbackTitle,
          });

          // 생체인증 성공 시 암호키를 Secure Storage에 저장
          const saved = await get().saveCryptoKey(options.cryptoKey);
          if (!saved) {
            const errorMsg = "암호키 저장에 실패했습니다.";
            set({ status: "error", error: errorMsg });
            return { success: false, error: errorMsg };
          }

          // 스토어 상태 업데이트
          set({ biometricEnabled: true, status: "success", error: null });
          return { success: true };
        } catch (error) {
          let errorMsg = "생체 인증 중 오류가 발생했습니다.";

          // 기존 에러 처리 로직 유지
          set({ status: "error", error: errorMsg });
          return { success: false, error: errorMsg };
        }
      },

      /**
       * Secure Storage에서 암호키 복원 (생체인증 없이)
       */
      getCryptoKey: async (): Promise<CryptoKey | null> => {
        try {
          const CRYPTO_KEY_KEY = "biometric_crypto_key";
          const encodedKey = await SecureStorage.get(CRYPTO_KEY_KEY);

          if (encodedKey && typeof encodedKey === "string") {
            const rawKey = fromBase64(encodedKey);

            const cryptoKey = await crypto.subtle.importKey(
              "raw",
              rawKey,
              {
                name: "AES-GCM",
              },
              true,
              ["encrypt", "decrypt"],
            );

            return cryptoKey;
          }

          return null;
        } catch (error) {
          console.error("암호키 복원 실패:", error);
          return null;
        }
      },

      /**
       * 암호키를 Secure Storage에 저장 (생체인증 연동용)
       */
      saveCryptoKey: async (cryptoKey: CryptoKey): Promise<boolean> => {
        try {
          const CRYPTO_KEY_KEY = "biometric_crypto_key";
          const base64Key = await exportCryptoKey(cryptoKey);
          await SecureStorage.set(CRYPTO_KEY_KEY, base64Key);
          return true;
        } catch (error) {
          console.error("암호키 저장 실패:", error);
          return false;
        }
      },

      /**
       * Secure Storage에서 암호키 삭제 (생체인증 비활성화/로그아웃 시)
       */
      clearCryptoKey: async (): Promise<boolean> => {
        try {
          const CRYPTO_KEY_KEY = "biometric_crypto_key";
          await SecureStorage.remove(CRYPTO_KEY_KEY);
          return true;
        } catch (error) {
          console.error("암호키 삭제 실패:", error);
          return false;
        }
      },

      /**
       * 생체인증 비활성화 (설정에서 생체인증 끌 때 사용)
       */
      disableBiometric: async (): Promise<{
        success: boolean;
        error?: string;
      }> => {
        try {
          const cleared = await get().clearCryptoKey();
          if (!cleared) {
            const errorMsg = "암호키 삭제에 실패했습니다.";
            set({ error: errorMsg });
            return { success: false, error: errorMsg };
          }

          set({ biometricEnabled: false, error: null });
          return { success: true };
        } catch (error) {
          let errorMsg = "생체인증 비활성화 중 오류가 발생했습니다.";
          if (error instanceof Error) {
            errorMsg = error.message;
          }
          set({ error: errorMsg });
          return { success: false, error: errorMsg };
        }
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
