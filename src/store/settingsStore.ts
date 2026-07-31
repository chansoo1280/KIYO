import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import type { FontSize } from "@/models/account";

export interface SettingsState {
  theme: "light" | "dark";
  fontSize: FontSize;
  setTheme: (theme: "light" | "dark") => Promise<void>;
  toggleTheme: () => Promise<void>;
  setFontSize: (fontSize: FontSize) => Promise<void>;
  initializeTheme: () => Promise<void>;
  initializeFontSize: () => Promise<void>;
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
      }),
      {
        name: "kiyo-settings",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          theme: state.theme,
          fontSize: state.fontSize,
        }),
      },
    ),
    { name: "settings-store" },
  ),
);
