import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import type { FontSize } from "../models/account";
import { KiyoAutofill } from "../plugins/kiyautofill";
import { Capacitor } from "@capacitor/core";

export interface SettingsState {
  theme: "light" | "dark";
  fontSize: FontSize;
  biometricEnabled: boolean; // Whether to use biometric authentication for autofill
  setTheme: (theme: "light" | "dark") => Promise<void>;
  toggleTheme: () => Promise<void>;
  setFontSize: (fontSize: FontSize) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  initializeTheme: () => Promise<void>;
  initializeFontSize: () => Promise<void>;
  initializeBiometricEnabled: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: "light" as "light" | "dark",
        fontSize: "medium" as FontSize,
        biometricEnabled: false, // Default ON for biometric authentication

        setTheme: async (theme: "light" | "dark") => {
          set({ theme });
          // Apply theme to document immediately
          if (theme === "dark") {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
          } else {
            document.documentElement.classList.add("light");
            document.documentElement.classList.remove("dark");
          }
          // Persist to localStorage via zustand persist middleware
        },

        toggleTheme: async () => {
          const newTheme = get().theme === "light" ? "dark" : "light";
          await get().setTheme(newTheme);
        },

        setFontSize: async (fontSize: FontSize) => {
          set({ fontSize });
          // Apply font size to document immediately
          const fontSizeClass =
            fontSize === "small" ? "sm" : fontSize === "medium" ? "base" : "lg";
          document.documentElement.classList.remove(
            "text-size-sm",
            "text-size-base",
            "text-size-lg",
          );
          document.documentElement.classList.add(`text-size-${fontSizeClass}`);
          // Persist to localStorage via zustand persist middleware
        },

        setBiometricEnabled: async (enabled: boolean) => {
          // 즉시 로컬 상태 업데이트 (낙관적 업데이트) - 모든 플랫폼에서 즉시 UI 반영
          set({ biometricEnabled: enabled });

          // Android 네이티브 동기화는 백그라운드에서 시도 (실패해도 UI 영향 없음)
          if (Capacitor.getPlatform() === "android") {
            try {
              await KiyoAutofill.setBiometricEnabled({ enabled });
              console.log(
                "Biometric setting synced to Android Autofill Service:",
                enabled,
              );
            } catch (error) {
              console.error(
                "Failed to sync biometric setting to Android:",
                error,
              );
              // 실패해도 로컬 상태는 유지 (사용자 의도 반영)
            }
          }
        },

        initializeTheme: async () => {
          // Theme is loaded from localStorage via zustand persist middleware
          const theme = get().theme;
          // Apply theme to document
          if (theme === "dark") {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
          } else {
            document.documentElement.classList.add("light");
            document.documentElement.classList.remove("dark");
          }
        },

        initializeFontSize: async () => {
          // Font size is loaded from localStorage via zustand persist middleware
          const fontSize = get().fontSize;
          // Apply font size to document
          const fontSizeClass =
            fontSize === "small" ? "sm" : fontSize === "medium" ? "base" : "lg";
          document.documentElement.classList.remove(
            "text-size-sm",
            "text-size-base",
            "text-size-lg",
          );
          document.documentElement.classList.add(`text-size-${fontSizeClass}`);
        },

        initializeBiometricEnabled: async () => {
          // Biometric enabled setting is loaded from localStorage via zustand persist middleware
          // No additional action needed
        },
      }),
      {
        name: "kiyo-settings",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          theme: state.theme,
          fontSize: state.fontSize,
          biometricEnabled: state.biometricEnabled,
        }),
      },
    ),
    { name: "settings-store" },
  ),
);
