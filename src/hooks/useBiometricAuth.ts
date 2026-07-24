import { useBiometricAuthStore } from "../store/biometricAuthStore";
import {
  BiometryError,
  BiometryErrorType,
  BiometricAuth,
} from "@aparajita/capacitor-biometric-auth";
import { exportCryptoKey, fromBase64 } from "../crypto/crypto.utils";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

type BiometricAuthResult = { success: true; cryptoKey: CryptoKey } | null;

export const useBiometricAuth = () => {
  const { setStatus, setError, setBiometricEnabled, isAvailable } =
    useBiometricAuthStore();

  /**
   * 생체인증 사용 가능 여부 확인 (스토어에서 가져오기)
   */
  // initialize is now directly from store

  /**
   * 생체인증 활성화 (설정에서 생체인증 켤 때 사용)
   * - 생체인증 가용성 확인
   * - 생체인증 수행
   * - 성공 시 암호키를 Secure Storage에 저장
   * - 스토어 상태 업데이트
   */
  const enableBiometric = async (options?: {
    reason?: string;
    cancelTitle?: string;
    allowDeviceCredential?: boolean;
    androidTitle?: string;
    androidSubtitle?: string;
    androidConfirmationRequired?: boolean;
    androidBiometryStrength?: number;
    iosFallbackTitle?: string;
    cryptoKey: CryptoKey; // PIN 잠금 해제 후 얻은 암호키
  }): Promise<{ success: boolean; error?: string }> => {
    // 생체인증 가용성 확인
    if (!isAvailable) {
      const errorMsg = "이 기기에서는 생체인증을 사용할 수 없습니다.";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (!options?.cryptoKey) {
      const errorMsg =
        "암호키가 필요합니다. PIN으로 잠금 해제 후 다시 시도해주세요.";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setStatus("authenticating");
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
      const saved = await saveCryptoKey(options.cryptoKey);
      if (!saved) {
        const errorMsg = "암호키 저장에 실패했습니다.";
        setStatus("error");
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // 스토어 상태 업데이트
      setBiometricEnabled(true);
      setStatus("success");
      setError(null);
      return { success: true };
    } catch (error) {
      let errorMsg = "생체 인증 중 오류가 발생했습니다.";

      if (error instanceof BiometryError) {
        switch (error.code) {
          case BiometryErrorType.userCancel:
            errorMsg = "사용자가 인증을 취소했습니다.";
            break;
          case BiometryErrorType.userFallback:
            errorMsg = "PIN/패턴 인증으로 전환되었습니다.";
            break;
          case BiometryErrorType.biometryLockout:
            errorMsg = "생체인증이 잠겼습니다. 잠시 후 다시 시도해주세요.";
            break;
          case BiometryErrorType.biometryNotAvailable:
            errorMsg = "생체인증을 사용할 수 없습니다.";
            break;
          case BiometryErrorType.biometryNotEnrolled:
            errorMsg =
              "등록된 생체정보가 없습니다. 설정에서 생체정보를 등록해주세요.";
            break;
          case BiometryErrorType.authenticationFailed:
            errorMsg = "생체인증에 실패했습니다. 다시 시도해주세요.";
            break;
          case BiometryErrorType.passcodeNotSet:
            errorMsg =
              "기기 잠금이 설정되어 있지 않습니다. 설정에서 잠금을 활성화해주세요.";
            break;
          case BiometryErrorType.noDeviceCredential:
            errorMsg = "기기 인증 정보가 없습니다.";
            break;
          default:
            errorMsg = error.message;
        }
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }

      setStatus("error");
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  /**
   * Secure Storage에서 암호키 복원 (생체인증 없이)
   * - 앱이 이미 잠금 해제된 상태에서 암호키가 필요할 때 사용
   * - 생체인증 없이 Secure Storage에서 바로 복원
   */
  const getCryptoKey = async (): Promise<CryptoKey | null> => {
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
  };

  /**
   * 생체인증 수행 및 암호키 반환
   * - 성공 시: Secure Storage에서 암호키 복원
   * - 실패 시: 에러 반환
   */
  const authenticate = async (options?: {
    reason?: string;
    cancelTitle?: string;
    allowDeviceCredential?: boolean;
    androidTitle?: string;
    androidSubtitle?: string;
    androidConfirmationRequired?: boolean;
    androidBiometryStrength?: number;
    iosFallbackTitle?: string;
  }): Promise<BiometricAuthResult> => {
    setStatus("authenticating");
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

        setStatus("success");
        setError(null);
        return {
          success: true,
          cryptoKey,
        };
      }

      const errorMsg =
        "저장된 암호키가 없습니다. PIN으로 잠금 해제 후 다시 시도해주세요.";
      setStatus("error");
      setError(errorMsg);
      return null;
    } catch (error) {
      let errorMsg = "생체 인증 중 오류가 발생했습니다.";

      if (error instanceof BiometryError) {
        switch (error.code) {
          case BiometryErrorType.userCancel:
            errorMsg = "사용자가 인증을 취소했습니다.";
            break;
          case BiometryErrorType.userFallback:
            errorMsg = "PIN/패턴 인증으로 전환되었습니다.";
            break;
          case BiometryErrorType.biometryLockout:
            errorMsg = "생체인증이 잠겼습니다. 잠시 후 다시 시도해주세요.";
            break;
          case BiometryErrorType.biometryNotAvailable:
            errorMsg = "생체인증을 사용할 수 없습니다.";
            break;
          case BiometryErrorType.biometryNotEnrolled:
            errorMsg =
              "등록된 생체정보가 없습니다. 설정에서 생체정보를 등록해주세요.";
            break;
          case BiometryErrorType.authenticationFailed:
            errorMsg = "생체인증에 실패했습니다. 다시 시도해주세요.";
            break;
          case BiometryErrorType.passcodeNotSet:
            errorMsg =
              "기기 잠금이 설정되어 있지 않습니다. 설정에서 잠금을 활성화해주세요.";
            break;
          case BiometryErrorType.noDeviceCredential:
            errorMsg = "기기 인증 정보가 없습니다.";
            break;
          default:
            errorMsg = error.message;
        }
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }

      setStatus("error");
      setError(errorMsg);
      return null;
    }
  };

  /**
   * 암호키를 Secure Storage에 저장 (생체인증 연동용)
   * - PIN 잠금 해제 성공 시 호출
   */
  const saveCryptoKey = async (cryptoKey: CryptoKey): Promise<boolean> => {
    try {
      const CRYPTO_KEY_KEY = "biometric_crypto_key";
      const base64Key = await exportCryptoKey(cryptoKey);
      await SecureStorage.set(CRYPTO_KEY_KEY, base64Key);
      return true;
    } catch (error) {
      console.error("암호키 저장 실패:", error);
      return false;
    }
  };

  /**
   * Secure Storage에서 암호키 삭제 (생체인증 비활성화/로그아웃 시)
   */
  const clearCryptoKey = async (): Promise<boolean> => {
    try {
      const CRYPTO_KEY_KEY = "biometric_crypto_key";
      await SecureStorage.remove(CRYPTO_KEY_KEY);
      return true;
    } catch (error) {
      console.error("암호키 삭제 실패:", error);
      return false;
    }
  };

  /**
   * 생체인증 비활성화 (설정에서 생체인증 끌 때 사용)
   * - Secure Storage에서 암호키 삭제
   * - 스토어 상태 업데이트
   */
  const disableBiometric = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      const cleared = await clearCryptoKey();
      if (!cleared) {
        const errorMsg = "암호키 삭제에 실패했습니다.";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setBiometricEnabled(false);
      setError(null);
      return { success: true };
    } catch (error) {
      let errorMsg = "생체인증 비활성화 중 오류가 발생했습니다.";
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  return {
    authenticate,
    enableBiometric,
    disableBiometric,
    getCryptoKey,
    saveCryptoKey,
    clearCryptoKey,
  };
};

export default useBiometricAuth;
