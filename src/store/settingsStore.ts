import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import type { FontSize } from "@/models/account";

export type AutoLockTimeout = "none" | "1m" | "10m" | "30m";

export interface SettingsState {
  theme: "light" | "dark";
  fontSize: FontSize;
  autoLockTimeout: AutoLockTimeout;
  biometricEnabled: boolean;
  autofillEnabled: boolean;
  autoBackupEnabled: boolean;
  autoBackupUri: string | null;
  setTheme: (theme: "light" | "dark") => Promise<void>;
  toggleTheme: () => Promise<void>;
  setFontSize: (fontSize: FontSize) => Promise<void>;
  setAutoLockTimeout: (timeout: AutoLockTimeout) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setAutofillEnabled: (enabled: boolean) => Promise<void>;
  setAutoBackupEnabled: (enabled: boolean) => Promise<void>;
  setAutoBackupUri: (uri: string | null) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: "light" as "light" | "dark",
        fontSize: "medium" as FontSize,
        autoLockTimeout: "none" as AutoLockTimeout,
        biometricEnabled: false,
        autofillEnabled: false,
        autoBackupEnabled: false,
        autoBackupUri: null,

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

        setAutoLockTimeout: async (timeout: AutoLockTimeout) => {
          set({ autoLockTimeout: timeout });
          // Persist to localStorage via zustand persist middleware
        },

        setBiometricEnabled: async (enabled: boolean) => {
          set({ biometricEnabled: enabled });
        },

        setAutofillEnabled: async (enabled: boolean) => {
          set({ autofillEnabled: enabled });
        },

        setAutoBackupEnabled: async (enabled: boolean) => {
          set({ autoBackupEnabled: enabled });
        },

        setAutoBackupUri: async (uri: string | null) => {
          set({ autoBackupUri: uri });
        },
      }),
      {
        name: "kiyo-settings",
        storage: createJSONStorage(() => localStorage),
        onRehydrateStorage: () => (state) => {
          // persist hydrate 직후 1회 호출 — <html>에 font-size 클래스 적용
          // App.tsx의 useEffect initializeFontSize() 이관 (Plan-D PR 1)
          if (state) {
            const fontSize = state.fontSize;
            const fontSizeClass =
              fontSize === "small"
                ? "sm"
                : fontSize === "medium"
                  ? "base"
                  : "lg";
            document.documentElement.classList.remove(
              "text-size-sm",
              "text-size-base",
              "text-size-lg",
            );
            document.documentElement.classList.add(
              `text-size-${fontSizeClass}`,
            );
          }
        },
        partialize: (state) => ({
          theme: state.theme,
          fontSize: state.fontSize,
          autoLockTimeout: state.autoLockTimeout,
          biometricEnabled: state.biometricEnabled,
          autofillEnabled: state.autofillEnabled,
          autoBackupEnabled: state.autoBackupEnabled,
          autoBackupUri: state.autoBackupUri,
        }),
      },
    ),
    { name: "settings-store" },
  ),
);