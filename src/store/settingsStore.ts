import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import type { FontSize } from "@/models/account";

export type AutoLockTimeout = "none" | "1m" | "10m" | "30m";

export interface SettingsState {
  theme: "light" | "dark";
  fontSize: FontSize;
  autoLockTimeout: AutoLockTimeout;
  biometricEnabled: boolean;
  setTheme: (theme: "light" | "dark") => Promise<void>;
  toggleTheme: () => Promise<void>;
  setFontSize: (fontSize: FontSize) => Promise<void>;
  setAutoLockTimeout: (timeout: AutoLockTimeout) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  initializeTheme: () => Promise<void>;
  initializeFontSize: () => Promise<void>;
  initializeAutoLockTimeout: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        theme: "light" as "light" | "dark",
        fontSize: "medium" as FontSize,
        autoLockTimeout: "none" as AutoLockTimeout,
        biometricEnabled: false,

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

        initializeAutoLockTimeout: async () => {
          // Auto lock timeout is loaded from localStorage via zustand persist middleware
          // No side effects needed, just ensure it's loaded
        },
      }),
      {
        name: "kiyo-settings",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          theme: state.theme,
          fontSize: state.fontSize,
          autoLockTimeout: state.autoLockTimeout,
          biometricEnabled: state.biometricEnabled,
        }),
      },
    ),
    { name: "settings-store" },
  ),
);