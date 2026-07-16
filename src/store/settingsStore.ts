import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { db } from "../database/db";
import type { FontSize, Setting } from "../models/account";

export interface SettingsState {
  theme: "light" | "dark";
  fontSize: FontSize;
  clipboardAutoClearTimeout: number; // 0 = disabled, otherwise milliseconds
  setTheme: (theme: "light" | "dark") => Promise<void>;
  toggleTheme: () => Promise<void>;
  setFontSize: (fontSize: FontSize) => Promise<void>;
  setClipboardAutoClearTimeout: (timeoutMs: number) => Promise<void>;
  initializeTheme: () => Promise<void>;
  initializeFontSize: () => Promise<void>;
  initializeClipboardAutoClearTimeout: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "light" as "light" | "dark",
      fontSize: "medium" as FontSize,
      clipboardAutoClearTimeout: 30000, // Default 30 seconds

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
        // Persist to database
        const settings = await db.settings.get(1);
        const newSettings: Setting = {
          theme,
          autoLockTime: settings?.autoLockTime ?? 0,
          lockEnabled: settings?.lockEnabled ?? false,
          fontSize: settings?.fontSize ?? "medium",
          clipboardAutoClearTimeout:
            settings?.clipboardAutoClearTimeout ?? 30000,
        };
        await db.settings.put(newSettings);
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
        // Persist to database
        const settings = await db.settings.get(1);
        const newSettings: Setting = {
          theme: settings?.theme ?? "light",
          autoLockTime: settings?.autoLockTime ?? 0,
          lockEnabled: settings?.lockEnabled ?? false,
          fontSize,
          clipboardAutoClearTimeout:
            settings?.clipboardAutoClearTimeout ?? 30000,
        };
        await db.settings.put(newSettings);
      },

      setClipboardAutoClearTimeout: async (timeoutMs: number) => {
        set({ clipboardAutoClearTimeout: timeoutMs });
        // Persist to database
        const settings = await db.settings.get(1);
        const newSettings: Setting = {
          theme: settings?.theme ?? "light",
          autoLockTime: settings?.autoLockTime ?? 0,
          lockEnabled: settings?.lockEnabled ?? false,
          fontSize: settings?.fontSize ?? "medium",
          clipboardAutoClearTimeout: timeoutMs,
        };
        await db.settings.put(newSettings);
      },

      initializeTheme: async () => {
        // Load theme from database
        const settings = await db.settings.get(1);
        const theme = settings?.theme ?? "light";
        set({ theme });
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
        // Load font size from database
        const settings = await db.settings.get(1);
        const fontSize = settings?.fontSize ?? "medium";
        set({ fontSize });
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

      initializeClipboardAutoClearTimeout: async () => {
        // Load clipboard auto-clear timeout from database
        const settings = await db.settings.get(1);
        const timeout = settings?.clipboardAutoClearTimeout ?? 30000;
        set({ clipboardAutoClearTimeout: timeout });
      },
    }),
    {
      name: "kiyo-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        clipboardAutoClearTimeout: state.clipboardAutoClearTimeout,
      }),
    },
  ),
);
