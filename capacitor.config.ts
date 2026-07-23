import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kiyo.app",
  appName: "kiyo",
  webDir: "dist",
  plugins: {
    KiyoAutofill: {},
    BiometricAuth: {
      reason: "앱 잠금 해제를 위해 생체 인증이 필요합니다.",
      title: "생체 인증",
      subtitle: "지문 또는 얼굴 인식을 사용하여 인증하세요",
      description: "앱 잠금을 해제하려면 생체 인증을 사용하세요",
      negativeButtonText: "취소",
      fallbackButtonText: "비밀번호 사용",
    },
    SecureStorage: {},
  },
};

export default config;
