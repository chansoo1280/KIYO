import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kiyo.app",
  appName: "kiyo",
  webDir: "dist",
  plugins: {
    KiyoAutofill: {},
  },
};

export default config;
