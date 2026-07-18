import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { db } from "../database/db";
import type { FontSize, Setting } from "../models/account";
import { KiyoAutofill } from "../plugins/kiyautofill";
import { Capacitor } from "@capacitor/core";

export interface SettingsState {
  theme: "light" | "dark";
  fontSize: FontSize;
  clipboardAutoClearTimeout: number; // 0 = disabled, otherwise milliseconds
  biometricEnabled: boolean; // Whether to use biometric authentication for autofill
  setTheme: (theme: "light" | "dark") => Promise<void>;
  toggleTheme: () => Promise<void>;
  setFontSize: (fontSize: FontSize) => Promise<void>;
  setClipboardAutoClearTimeout: (timeoutMs: number) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  initializeTheme: () => Promise<void>;
  initializeFontSize: () => Promise<void>;
  initializeClipboardAutoClearTimeout: () => Promise<void>;
  initializeBiometricEnabled: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "light" as "light" | "dark",
      fontSize: "medium" as FontSize,
      clipboardAutoClearTimeout: 30000, // Default 30 seconds
      biometricEnabled: true, // Default ON for biometric authentication

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
          biometricEnabled: settings?.biometricEnabled ?? true,
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
          biometricEnabled: settings?.biometricEnabled ?? true,
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
          biometricEnabled: settings?.biometricEnabled ?? true,
        };
        await db.settings.put(newSettings);
      },

      setBiometricEnabled: async (enabled: boolean) => {
        set({ biometricEnabled: enabled });
        // Persist to database
        const settings = await db.settings.get(1);
        const newSettings: Setting = {
          theme: settings?.theme ?? "light",
          autoLockTime: settings?.autoLockTime ?? 0,
          lockEnabled: settings?.lockEnabled ?? false,
          fontSize: settings?.fontSize ?? "medium",
          clipboardAutoClearTimeout:
            settings?.clipboardAutoClearTimeout ?? 30000,
          biometricEnabled: enabled,
        };
        await db.settings.put(newSettings);
        
        // Sync with native Android Autofill Service via Capacitor plugin
        if (Capacitor.getPlatform() === "android") {
          try {
            await KiyoAutofill.setBiometricEnabled({ enabled });
            console.log("Biometric setting synced to Android Autofill Service:", enabled);
          } catch (error) {
            console.error("Failed to sync biometric setting to Android:", error);
          }
        }
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

      initializeBiometricEnabled: async () => {
        // Load biometric enabled setting from database
        const settings = await db.settings.get(1);
        const enabled = settings?.biometricEnabled ?? true;
        set({ biometricEnabled: enabled });
      },
    }),
    {
      name: "kiyo-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        clipboardAutoClearTimeout: state.clipboardAutoClearTimeout,
        biometricEnabled: state.biometricEnabled,
      }),
    },
  ),
);
