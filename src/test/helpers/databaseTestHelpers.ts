// ============================================
// Test Data Helpers
// ============================================

import type { AppSettings, FileMetadata } from "../../models/account";

export const getDefaultSettings = (): AppSettings[] => [
  { theme: "dark", autoLockTime: 300, lockEnabled: true, fontSize: "medium", clipboardAutoClearTimeout: 30000 },
];

export const getDefaultMetadata = (): FileMetadata[] => [
  { id: 1, version: "1.0.0", createdAt: Date.now() },
];

export const getEncryptedSettings = (): AppSettings[] => [
  { theme: "dark", autoLockTime: 300, lockEnabled: true, fontSize: "medium", clipboardAutoClearTimeout: 30000 },
];

export const getEncryptedMetadata = (): FileMetadata[] => [
  { id: 1, version: "1.0.0", createdAt: Date.now() },
];
